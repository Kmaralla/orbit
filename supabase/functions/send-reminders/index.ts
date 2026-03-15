// Supabase Edge Function: Daily Check-in Digest
// Sends ONE gentle email per user with all their orbits
// Deploy: supabase functions deploy send-reminders
// Schedule twice daily in Supabase Dashboard → Edge Functions → Schedules:
//   - 0 6 * * *  (12:00 PM IST / 6:00 AM UTC)
//   - 0 14 * * * (8:00 PM IST / 2:00 PM UTC)
// Note: Adds 10 second delay between users to avoid Resend rate limits

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Usecase {
  id: string
  name: string
  icon: string
  notify_email: string
  user_id: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const appUrl = Deno.env.get('APP_URL') || 'https://www.orbityours.com'

    // Determine time of day for greeting (IST = UTC+5:30)
    const now = new Date()
    const istHour = (now.getUTCHours() + 5) % 24 + (now.getUTCMinutes() >= 30 ? 1 : 0)
    const isEvening = istHour >= 17 // 5 PM or later IST
    const greeting = isEvening ? "Evening check-in time" : "Midday check-in time"
    const timeLabel = isEvening ? "Evening" : "Midday"

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables')
    }

    if (!resendApiKey) {
      throw new Error('Missing RESEND_API_KEY environment variable')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get all orbits that have email reminders enabled
    const { data: usecases, error: fetchError } = await supabase
      .from('usecases')
      .select('id, name, icon, notify_email, user_id')
      .not('notify_email', 'is', null)

    if (fetchError) {
      console.error('Error fetching usecases:', fetchError)
      throw fetchError
    }

    // Group orbits by email (one email per user)
    const orbitsByEmail: Record<string, Usecase[]> = {}
    for (const uc of (usecases as Usecase[]) ?? []) {
      if (!orbitsByEmail[uc.notify_email]) {
        orbitsByEmail[uc.notify_email] = []
      }
      orbitsByEmail[uc.notify_email].push(uc)
    }

    const emails = Object.keys(orbitsByEmail)
    console.log(`Sending daily digest to ${emails.length} users`)

    const results: { email: string; status: string; orbitCount: number; error?: string }[] = []

    // Helper function to sleep (avoid rate limits)
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i]

      // Wait 10 seconds between users (skip for first user)
      if (i > 0) {
        console.log(`Waiting 10 seconds before sending to next user...`)
        await sleep(10000)
      }
      const orbits = orbitsByEmail[email]

      // Build orbit links HTML
      const orbitLinksHtml = orbits.map(uc => `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #1a1a2e;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width: 50px; font-size: 28px; vertical-align: middle;">
                  ${uc.icon || '🎯'}
                </td>
                <td style="vertical-align: middle;">
                  <div style="color: #e8e4f0; font-size: 16px; font-weight: 600; margin-bottom: 2px;">
                    ${uc.name}
                  </div>
                </td>
                <td style="text-align: right; vertical-align: middle;">
                  <a href="${appUrl}/usecase/${uc.id}"
                     style="display: inline-block; background: #6c63ff; color: #fff;
                            padding: 8px 16px; border-radius: 8px; text-decoration: none;
                            font-size: 13px; font-weight: 500;">
                    Check in
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `).join('')

      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #080810; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #080810; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom: 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size: 22px; font-weight: 700; color: #e8e4f0;">
                      <span style="color: #6c63ff;">●</span> Orbit
                    </span>
                  </td>
                  <td style="text-align: right; color: #4a4870; font-size: 13px;">
                    Daily Check-in
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding-bottom: 20px;">
              <h1 style="color: #e8e4f0; font-size: 20px; font-weight: 600; margin: 0 0 8px 0;">
                Hey! ${greeting} ✨
              </h1>
              <p style="color: #6b6890; font-size: 14px; margin: 0; line-height: 1.5;">
                ${orbits.length === 1
                  ? "Here's your orbit for today. Takes 30 seconds."
                  : `You have ${orbits.length} orbits to check. Takes a minute.`}
              </p>
            </td>
          </tr>

          <!-- Orbit Cards -->
          <tr>
            <td style="background-color: #0d0d1a; border-radius: 16px; border: 1px solid #1a1a2e; padding: 8px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${orbitLinksHtml}
              </table>
            </td>
          </tr>

          <!-- Dashboard Link -->
          <tr>
            <td style="padding-top: 20px; text-align: center;">
              <a href="${appUrl}/dashboard"
                 style="color: #6c63ff; font-size: 13px; text-decoration: none;">
                Open Dashboard →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top: 32px; text-align: center;">
              <p style="color: #3a3858; font-size: 11px; margin: 0;">
                You're receiving this because you enabled reminders.<br>
                Edit your orbit to change notification settings.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim()

      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Orbit <reminders@orbityours.com>',
            to: email,
            subject: orbits.length === 1
              ? `${orbits[0].icon || '○'} ${timeLabel}: ${orbits[0].name}`
              : `○ ${timeLabel} check-in · ${orbits.length} orbits`,
            html: emailHtml,
          }),
        })

        const responseData = await response.json()

        if (!response.ok) {
          console.error(`Failed to send to ${email}:`, responseData)
          results.push({ email, status: 'failed', orbitCount: orbits.length, error: responseData.message })
        } else {
          console.log(`Sent digest to ${email} (${orbits.length} orbits)`)
          results.push({ email, status: 'sent', orbitCount: orbits.length })
        }
      } catch (emailError) {
        console.error(`Error sending to ${email}:`, emailError)
        results.push({ email, status: 'error', orbitCount: orbits.length, error: String(emailError) })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        usersNotified: emails.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
