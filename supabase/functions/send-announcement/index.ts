// One-off announcement email to all users
// Invoke with: { "send": true } to actually send emails
// Without "send": true, it will just show who would receive it (dry run)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    if (!supabaseUrl || !supabaseServiceKey || !resendApiKey) {
      throw new Error('Missing environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check if this is a real send or dry run
    let actualSend = false
    try {
      const body = await req.json()
      if (body?.send === true) actualSend = true
    } catch {
      // No body = dry run
    }

    // Get all unique user emails from usecases table
    const { data: usecases } = await supabase
      .from('usecases')
      .select('notify_email, user_id, name, icon')
      .not('notify_email', 'is', null)

    // Get unique emails
    const emailMap: Record<string, { orbits: { name: string; icon: string }[] }> = {}
    for (const uc of usecases || []) {
      if (!emailMap[uc.notify_email]) {
        emailMap[uc.notify_email] = { orbits: [] }
      }
      emailMap[uc.notify_email].orbits.push({ name: uc.name, icon: uc.icon })
    }

    const emails = Object.keys(emailMap)

    if (!actualSend) {
      return new Response(
        JSON.stringify({
          dryRun: true,
          message: 'Add { "send": true } to actually send emails',
          wouldSendTo: emails,
          totalUsers: emails.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results: { email: string; status: string; error?: string }[] = []
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i]
      const userData = emailMap[email]

      if (i > 0) {
        await sleep(5000) // Rate limit
      }

      const orbitList = userData.orbits.slice(0, 3).map(o =>
        `<span style="display: inline-block; background: #6c63ff22; padding: 4px 10px; border-radius: 6px; margin: 2px; font-size: 13px;">${o.icon} ${o.name}</span>`
      ).join(' ')

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
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px;">
          <!-- Header -->
          <tr>
            <td style="padding-bottom: 24px;">
              <span style="font-size: 24px; font-weight: 700; color: #e8e4f0;">
                <span style="color: #6c63ff;">●</span> Orbit
              </span>
            </td>
          </tr>

          <!-- New Feature Announcement -->
          <tr>
            <td style="padding-bottom: 24px;">
              <div style="background: linear-gradient(135deg, #6c63ff22 0%, #6c63ff11 100%); border: 1px solid #6c63ff44; border-radius: 16px; padding: 24px; text-align: center;">
                <div style="font-size: 40px; margin-bottom: 12px;">✨</div>
                <h1 style="color: #e8e4f0; font-size: 22px; font-weight: 700; margin: 0 0 8px 0;">
                  New: Build Any Habit with AI
                </h1>
                <p style="color: #a8a4c8; font-size: 15px; margin: 0; line-height: 1.6;">
                  Tell us what habit you want to build, and we'll create a personalized tracking orbit for you in seconds.
                </p>
              </div>
            </td>
          </tr>

          <!-- How it works -->
          <tr>
            <td style="background-color: #0d0d1a; border-radius: 16px; border: 1px solid #1a1a2e; padding: 24px; margin-bottom: 20px;">
              <div style="color: #8b87a8; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 16px;">
                How it works
              </div>

              <div style="display: flex; margin-bottom: 16px;">
                <div style="width: 28px; height: 28px; background: #6c63ff; border-radius: 50%; color: white; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">1</div>
                <div style="margin-left: 12px;">
                  <div style="color: #e8e4f0; font-size: 14px; font-weight: 600;">Tell us your goal</div>
                  <div style="color: #6b6890; font-size: 13px;">"I want to read more books"</div>
                </div>
              </div>

              <div style="display: flex; margin-bottom: 16px;">
                <div style="width: 28px; height: 28px; background: #6c63ff; border-radius: 50%; color: white; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">2</div>
                <div style="margin-left: 12px;">
                  <div style="color: #e8e4f0; font-size: 14px; font-weight: 600;">AI creates your orbit</div>
                  <div style="color: #6b6890; font-size: 13px;">Personalized checklist items to track</div>
                </div>
              </div>

              <div style="display: flex;">
                <div style="width: 28px; height: 28px; background: #6c63ff; border-radius: 50%; color: white; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">3</div>
                <div style="margin-left: 12px;">
                  <div style="color: #e8e4f0; font-size: 14px; font-weight: 600;">Start building your habit</div>
                  <div style="color: #6b6890; font-size: 13px;">Daily check-ins, streaks & insights</div>
                </div>
              </div>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 24px 0; text-align: center;">
              <a href="${appUrl}/dashboard"
                 style="display: inline-block; background: linear-gradient(135deg, #6c63ff 0%, #5b54e0 100%);
                        color: #fff; padding: 16px 32px; border-radius: 12px; text-decoration: none;
                        font-size: 16px; font-weight: 600;">
                ✨ Try Build Habit Now
              </a>
            </td>
          </tr>

          <!-- Existing orbits reminder -->
          <tr>
            <td style="background-color: #0d0d1a; border-radius: 16px; border: 1px solid #1a1a2e; padding: 20px;">
              <div style="color: #e8e4f0; font-size: 15px; font-weight: 600; margin-bottom: 12px;">
                📋 Don't forget today's check-in!
              </div>
              <div style="margin-bottom: 16px;">
                ${orbitList}
                ${userData.orbits.length > 3 ? `<span style="color: #6b6890; font-size: 13px;">+${userData.orbits.length - 3} more</span>` : ''}
              </div>
              <a href="${appUrl}/quick-checkin"
                 style="display: inline-block; background: #1a1a2e; color: #6c63ff;
                        padding: 10px 20px; border-radius: 8px; text-decoration: none;
                        font-size: 14px; font-weight: 500; border: 1px solid #6c63ff44;">
                Quick Check-in →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top: 32px; text-align: center;">
              <p style="color: #3a3858; font-size: 11px; margin: 0;">
                You're receiving this because you use Orbit.<br>
                Keep building great habits! 🚀
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
            from: 'Orbit <hello@orbityours.com>',
            to: email,
            subject: '✨ New: Build Any Habit with AI — Try it now!',
            html: emailHtml,
          }),
        })

        const responseData = await response.json()

        if (!response.ok) {
          console.error(`Failed to send to ${email}:`, responseData)
          results.push({ email, status: 'failed', error: responseData.message })
        } else {
          console.log(`✓ Sent to ${email}`)
          results.push({ email, status: 'sent' })
        }
      } catch (err) {
        results.push({ email, status: 'error', error: String(err) })
      }
    }

    const sent = results.filter(r => r.status === 'sent').length
    const failed = results.filter(r => r.status !== 'sent').length

    // Log it
    await supabase.from('function_logs').insert({
      function_name: 'send-announcement',
      status: 'success',
      details: { sent, failed, subject: 'Build Habit Feature Launch' }
    })

    return new Response(
      JSON.stringify({ success: true, sent, failed, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
