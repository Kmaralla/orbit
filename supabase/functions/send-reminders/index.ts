// Supabase Edge Function: Send Email Reminders at User's Configured Time
// Deploy: supabase functions deploy send-reminders
// Schedule: Run every hour (0 * * * *) to check for users whose reminder time matches
// Test: Invoke with { "test": true } to send to all users regardless of time

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
  notify_time: string
  user_id: string
}

// Get current hour in a specific timezone
function getHourInTimezone(timezone: string): number {
  try {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false
    })
    return parseInt(formatter.format(now), 10)
  } catch {
    return -1
  }
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

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables')
    }

    if (!resendApiKey) {
      throw new Error('Missing RESEND_API_KEY environment variable')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check for test mode
    let forceAll = false
    try {
      const body = await req.json()
      if (body?.test === true) forceAll = true
    } catch {
      // No body, that's fine
    }

    // Get current hour in IST (default timezone for now)
    const currentHourIST = getHourInTimezone('Asia/Kolkata')
    console.log(`Current hour in IST: ${currentHourIST}`)

    // Log invocation start
    await supabase.from('function_logs').insert({
      function_name: 'send-reminders',
      status: 'started',
      details: { testMode: forceAll, currentHourIST, timestamp: new Date().toISOString() }
    })

    // Get all orbits with email reminders enabled
    const { data: allUsecases, error: fetchError } = await supabase
      .from('usecases')
      .select('id, name, icon, notify_email, notify_time, user_id')
      .not('notify_email', 'is', null)

    if (fetchError) {
      console.error('Error fetching usecases:', fetchError)
      throw fetchError
    }

    // Filter to only orbits whose notify_time matches current hour (unless test mode)
    const usecases = forceAll
      ? allUsecases
      : (allUsecases as Usecase[])?.filter(uc => {
          if (!uc.notify_time) return false
          const reminderHour = parseInt(uc.notify_time.split(':')[0], 10)
          console.log(`Orbit "${uc.name}": reminder at ${uc.notify_time} (hour ${reminderHour}), current hour: ${currentHourIST}`)
          return reminderHour === currentHourIST
        })

    if (!usecases || usecases.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: forceAll ? 'No users with reminders configured' : `No reminders scheduled for hour ${currentHourIST}`,
          totalOrbitsWithReminders: allUsecases?.length || 0,
          sent: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Group orbits by email
    const orbitsByEmail: Record<string, Usecase[]> = {}
    for (const uc of usecases as Usecase[]) {
      if (!orbitsByEmail[uc.notify_email]) {
        orbitsByEmail[uc.notify_email] = []
      }
      orbitsByEmail[uc.notify_email].push(uc)
    }

    const emails = Object.keys(orbitsByEmail)
    console.log(`Sending reminders to ${emails.length} users for ${usecases.length} orbits`)

    const results: { email: string; status: string; orbitCount: number; error?: string }[] = []
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    // Determine greeting based on time
    const isEvening = currentHourIST >= 17
    const isMorning = currentHourIST < 12
    const greeting = isEvening ? "Evening check-in time" : isMorning ? "Morning check-in time" : "Time for your check-in"

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i]

      if (i > 0) {
        console.log(`Waiting 10 seconds before next user...`)
        await sleep(10000)
      }

      const orbits = orbitsByEmail[email]

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
          <tr>
            <td style="background-color: #0d0d1a; border-radius: 16px; border: 1px solid #1a1a2e; padding: 8px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${orbitLinksHtml}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 20px; text-align: center;">
              <a href="${appUrl}/dashboard"
                 style="color: #6c63ff; font-size: 13px; text-decoration: none;">
                Open Dashboard →
              </a>
            </td>
          </tr>
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
              ? `${orbits[0].icon || '○'} Reminder: ${orbits[0].name}`
              : `○ Check-in reminder · ${orbits.length} orbits`,
            html: emailHtml,
          }),
        })

        const responseData = await response.json()

        if (!response.ok) {
          console.error(`Failed to send to ${email}:`, responseData)
          results.push({ email, status: 'failed', orbitCount: orbits.length, error: responseData.message })
        } else {
          console.log(`✓ Sent to ${email} (${orbits.length} orbits)`)
          results.push({ email, status: 'sent', orbitCount: orbits.length })
        }
      } catch (emailError) {
        console.error(`Error sending to ${email}:`, emailError)
        results.push({ email, status: 'error', orbitCount: orbits.length, error: String(emailError) })
      }
    }

    const sent = results.filter(r => r.status === 'sent').length
    const failed = results.filter(r => r.status !== 'sent').length

    // Log success
    await supabase.from('function_logs').insert({
      function_name: 'send-reminders',
      status: 'success',
      details: {
        testMode: forceAll,
        currentHourIST,
        totalOrbitsWithReminders: allUsecases?.length || 0,
        orbitsMatchingTime: usecases.length,
        sent,
        failed
      }
    })

    return new Response(
      JSON.stringify({
        success: true,
        currentHour: currentHourIST,
        testMode: forceAll,
        totalOrbitsWithReminders: allUsecases?.length || 0,
        orbitsMatchingTime: usecases.length,
        usersNotified: sent,
        failed,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
