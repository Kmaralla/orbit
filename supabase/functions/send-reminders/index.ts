// Supabase Edge Function: Send Daily Check-in Reminders
// Deploy: supabase functions deploy send-reminders
// Schedule: Supabase Dashboard → Edge Functions → Schedules → */5 * * * * (every 5 min)

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

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const appUrl = Deno.env.get('APP_URL') || 'https://your-app.vercel.app'

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables')
    }

    if (!resendApiKey) {
      throw new Error('Missing RESEND_API_KEY environment variable')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get current time in HH:MM format
    const now = new Date()
    const currentHour = now.getUTCHours().toString().padStart(2, '0')
    const currentMinute = now.getUTCMinutes().toString().padStart(2, '0')
    const currentTime = `${currentHour}:${currentMinute}`

    // Also check times within a 5-minute window (since cron runs every 5 min)
    const times: string[] = []
    for (let i = 0; i < 5; i++) {
      const checkTime = new Date(now.getTime() - i * 60000)
      const h = checkTime.getUTCHours().toString().padStart(2, '0')
      const m = checkTime.getUTCMinutes().toString().padStart(2, '0')
      times.push(`${h}:${m}:00`) // Include seconds for time type
    }

    console.log(`Checking for reminders at times: ${times.join(', ')}`)

    // Find usecases with reminders due now
    const { data: usecases, error: fetchError } = await supabase
      .from('usecases')
      .select('id, name, icon, notify_email, notify_time, user_id')
      .not('notify_email', 'is', null)
      .not('notify_time', 'is', null)
      .in('notify_time', times)

    if (fetchError) {
      console.error('Error fetching usecases:', fetchError)
      throw fetchError
    }

    console.log(`Found ${usecases?.length || 0} usecases with reminders due`)

    const results: { email: string; status: string; error?: string }[] = []

    for (const usecase of (usecases as Usecase[]) ?? []) {
      const checkInUrl = `${appUrl}/usecase/${usecase.id}`

      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Orbit Check-in Reminder</title>
</head>
<body style="margin: 0; padding: 0; background-color: #080810; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #080810; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="500" cellpadding="0" cellspacing="0" style="max-width: 500px;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom: 30px;">
              <span style="font-family: 'Syne', sans-serif; font-size: 28px; font-weight: 700; color: #e8e4f0;">
                <span style="color: #6c63ff;">O</span>rbit
              </span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color: #0d0d1a; border-radius: 16px; border: 1px solid #1a1a2e; padding: 32px;">
              <!-- Icon -->
              <div style="text-align: center; font-size: 48px; margin-bottom: 16px;">
                ${usecase.icon || '🎯'}
              </div>

              <!-- Title -->
              <h1 style="color: #e8e4f0; font-family: 'Syne', sans-serif; font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 12px 0;">
                Time for your check-in!
              </h1>

              <!-- Orbit name -->
              <p style="color: #9b8fb8; font-size: 16px; text-align: center; margin: 0 0 24px 0;">
                ${usecase.name}
              </p>

              <!-- CTA Button -->
              <div style="text-align: center;">
                <a href="${checkInUrl}" style="display: inline-block; background: linear-gradient(135deg, #6c63ff, #9b59b6); color: #ffffff; font-weight: 600; font-size: 16px; padding: 14px 32px; border-radius: 12px; text-decoration: none;">
                  Check In Now
                </a>
              </div>

              <!-- Direct link -->
              <p style="color: #4a4870; font-size: 12px; text-align: center; margin: 24px 0 0 0;">
                Or copy this link:<br>
                <a href="${checkInUrl}" style="color: #6c63ff; text-decoration: none; word-break: break-all;">
                  ${checkInUrl}
                </a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top: 24px; text-align: center;">
              <p style="color: #4a4870; font-size: 12px; margin: 0;">
                You're receiving this because you set a reminder for "${usecase.name}".<br>
                To stop these emails, edit your orbit settings.
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
            from: 'Orbit <reminders@orbit.app>', // Update with your verified domain
            to: usecase.notify_email,
            subject: `${usecase.icon || '⏰'} Time for your ${usecase.name} check-in`,
            html: emailHtml,
          }),
        })

        const responseData = await response.json()

        if (!response.ok) {
          console.error(`Failed to send email to ${usecase.notify_email}:`, responseData)
          results.push({
            email: usecase.notify_email,
            status: 'failed',
            error: responseData.message || 'Unknown error',
          })
        } else {
          console.log(`Email sent successfully to ${usecase.notify_email}`)
          results.push({
            email: usecase.notify_email,
            status: 'sent',
          })
        }
      } catch (emailError) {
        console.error(`Error sending email to ${usecase.notify_email}:`, emailError)
        results.push({
          email: usecase.notify_email,
          status: 'error',
          error: String(emailError),
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked_time: currentTime,
        reminders_found: usecases?.length || 0,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: String(error),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
