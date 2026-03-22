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

      if (i > 0) await sleep(5000)

      const orbitCount = userData.orbits.length
      const orbitPreview = userData.orbits.slice(0, 3).map(o =>
        `<span style="display:inline-block;background:#6c63ff22;border:1px solid #6c63ff33;padding:5px 12px;border-radius:20px;margin:3px;font-size:13px;color:#a8a4c8;">${o.icon} ${o.name}</span>`
      ).join('')

      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Build My Day — New in Orbit</title>
</head>
<body style="margin:0;padding:0;background:#080810;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#080810;padding:32px 16px;">
  <tr><td align="center">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;">

    <!-- Logo -->
    <tr><td style="padding-bottom:28px;">
      <span style="font-size:22px;font-weight:700;color:#e8e4f0;">
        <span style="color:#6c63ff;">●</span> Orbit
      </span>
    </td></tr>

    <!-- Hero -->
    <tr><td style="padding-bottom:24px;">
      <div style="background:linear-gradient(135deg,#1a1040 0%,#0d0d1a 100%);border:1px solid #6c63ff55;border-radius:20px;padding:32px 28px;text-align:center;">
        <div style="font-size:44px;margin-bottom:16px;">🗓️</div>
        <h1 style="color:#e8e4f0;font-size:26px;font-weight:800;margin:0 0 12px 0;letter-spacing:-0.5px;line-height:1.2;">
          Introducing: Build My Day
        </h1>
        <p style="color:#a8a4c8;font-size:16px;margin:0;line-height:1.7;">
          You track life across multiple orbits — but every morning the question is the same:<br>
          <strong style="color:#e8e4f0;">What do I actually focus on today?</strong>
        </p>
        <div style="margin-top:20px;padding:16px;background:#ffffff08;border-radius:12px;">
          <p style="color:#8a86a0;font-size:14px;margin:0;line-height:1.6;">
            Answer 3 quick questions. Orbit's AI looks at all your tasks, your streaks, and what you told it — then hands you a focused, realistic plan for the day. No overwhelm. Just clarity.
          </p>
        </div>
      </div>
    </td></tr>

    <!-- The problem it solves -->
    <tr><td style="padding-bottom:20px;">
      <div style="background:#0d0d1a;border:1px solid #1a1a2e;border-radius:16px;padding:22px 24px;">
        <div style="color:#6c63ff;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;">The problem it solves</div>
        <p style="color:#a8a4c8;font-size:14px;line-height:1.7;margin:0;">
          When you track ${orbitCount > 1 ? `${orbitCount} orbits` : 'multiple orbits'} you might have <strong style="color:#e8e4f0;">15–20 tasks available on any given day</strong>. Trying to do all of them is exhausting. Ignoring some feels like failure.
          <br><br>
          Build My Day cuts through that. On a busy day with low energy, it picks your 5 most important tasks. On a free day when you're fired up, it opens everything up. The AI understands <em>what actually matters</em> based on your orbits, your streaks, and how you feel today.
        </p>
      </div>
    </td></tr>

    <!-- How it works — visual flow -->
    <tr><td style="padding-bottom:20px;">
      <div style="background:#0d0d1a;border:1px solid #1a1a2e;border-radius:16px;padding:22px 24px;">
        <div style="color:#6c63ff;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:20px;">How it works — 3 steps</div>

        <!-- Step 1 -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
          <tr>
            <td width="36" valign="top">
              <div style="width:28px;height:28px;background:linear-gradient(135deg,#6c63ff,#9b59b6);border-radius:50%;color:#fff;font-size:13px;font-weight:700;text-align:center;line-height:28px;">1</div>
            </td>
            <td style="padding-left:12px;">
              <div style="color:#e8e4f0;font-size:14px;font-weight:700;margin-bottom:8px;">Tap "Build My Day" on your dashboard</div>
              <!-- Mini mockup of the button -->
              <div style="background:#0a0a16;border:1px solid #1a1a2e;border-radius:12px;padding:12px 16px;display:inline-block;">
                <span style="color:#a8a4c8;font-size:12px;">Dashboard buttons:</span>
                <div style="margin-top:8px;display:flex;gap:8px;">
                  <span style="display:inline-block;background:#1a1a2e;border:1px solid #6c63ff;border-radius:8px;padding:7px 14px;color:#6c63ff;font-size:12px;font-weight:600;">🗓️ Build My Day</span>
                  <span style="display:inline-block;background:#1a1a2e;border:1px solid #2a2a40;border-radius:8px;padding:7px 14px;color:#8a86a0;font-size:12px;">+ New Orbit</span>
                </div>
              </div>
            </td>
          </tr>
        </table>

        <!-- Step 2 -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
          <tr>
            <td width="36" valign="top">
              <div style="width:28px;height:28px;background:linear-gradient(135deg,#6c63ff,#9b59b6);border-radius:50%;color:#fff;font-size:13px;font-weight:700;text-align:center;line-height:28px;">2</div>
            </td>
            <td style="padding-left:12px;">
              <div style="color:#e8e4f0;font-size:14px;font-weight:700;margin-bottom:8px;">Answer 3 quick questions</div>
              <!-- Mini mockup of the questions -->
              <div style="background:#0a0a16;border:1px solid #1a1a2e;border-radius:12px;padding:14px 16px;">
                <div style="color:#6b6890;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;">How much time do you have?</div>
                <div style="margin-bottom:12px;">
                  <span style="display:inline-block;background:#6c63ff22;border:1.5px solid #6c63ff;border-radius:10px;padding:6px 14px;color:#6c63ff;font-size:12px;font-weight:600;margin-right:6px;">⚡ Quick  15 min</span>
                  <span style="display:inline-block;background:#1a1a2e;border:1px solid #2a2a40;border-radius:10px;padding:6px 14px;color:#4a4860;font-size:12px;margin-right:6px;">✓ Normal</span>
                  <span style="display:inline-block;background:#1a1a2e;border:1px solid #2a2a40;border-radius:10px;padding:6px 14px;color:#4a4860;font-size:12px;">🎯 All In</span>
                </div>
                <div style="color:#6b6890;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;">What's your energy?</div>
                <div>
                  <span style="display:inline-block;background:#1a1a2e;border:1px solid #2a2a40;border-radius:10px;padding:6px 14px;color:#4a4860;font-size:12px;margin-right:6px;">🔋 Low</span>
                  <span style="display:inline-block;background:#6c63ff22;border:1.5px solid #6c63ff;border-radius:10px;padding:6px 14px;color:#6c63ff;font-size:12px;font-weight:600;margin-right:6px;">⚡ Good</span>
                  <span style="display:inline-block;background:#1a1a2e;border:1px solid #2a2a40;border-radius:10px;padding:6px 14px;color:#4a4860;font-size:12px;">🚀 High</span>
                </div>
              </div>
            </td>
          </tr>
        </table>

        <!-- Step 3 -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="36" valign="top">
              <div style="width:28px;height:28px;background:linear-gradient(135deg,#6c63ff,#9b59b6);border-radius:50%;color:#fff;font-size:13px;font-weight:700;text-align:center;line-height:28px;">3</div>
            </td>
            <td style="padding-left:12px;">
              <div style="color:#e8e4f0;font-size:14px;font-weight:700;margin-bottom:8px;">Get your personalized plan</div>
              <!-- Mini mockup of a plan card -->
              <div style="background:#0a0a16;border:1px solid #1a1a2e;border-radius:12px;padding:14px 16px;">
                <!-- High priority orbit card -->
                <div style="background:#22c55e18;border:1.5px solid #22c55e44;border-radius:10px;padding:12px 14px;margin-bottom:8px;">
                  <div style="display:flex;align-items:center;margin-bottom:8px;">
                    <span style="font-size:18px;">👴</span>
                    <span style="color:#e8e4f0;font-size:13px;font-weight:700;margin-left:8px;flex:1;">Dad's Health</span>
                    <span style="background:#22c55e22;color:#22c55e;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;">Must Do</span>
                  </div>
                  <div style="color:#a8a4c8;font-size:12px;line-height:1.8;">
                    · Morning medication check<br>
                    · Blood pressure log
                  </div>
                  <div style="color:#6b6890;font-size:11px;margin-top:8px;padding-top:8px;border-top:1px solid #1a1a2e;">
                    Streak at risk — takes 2 minutes, keeps the data flowing.
                  </div>
                </div>
                <!-- Medium priority -->
                <div style="background:#6c63ff18;border:1.5px solid #6c63ff44;border-radius:10px;padding:12px 14px;">
                  <div style="display:flex;align-items:center;margin-bottom:8px;">
                    <span style="font-size:18px;">💼</span>
                    <span style="color:#e8e4f0;font-size:13px;font-weight:700;margin-left:8px;flex:1;">Career Goals</span>
                    <span style="background:#6c63ff22;color:#6c63ff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;">Do It</span>
                  </div>
                  <div style="color:#a8a4c8;font-size:12px;">· Daily learning block</div>
                </div>
              </div>
            </td>
          </tr>
        </table>
      </div>
    </td></tr>

    <!-- Key insight callout -->
    <tr><td style="padding-bottom:24px;">
      <div style="background:linear-gradient(135deg,#6c63ff15,#9b59b615);border:1px solid #6c63ff33;border-radius:16px;padding:20px 24px;text-align:center;">
        <p style="color:#c8c4e8;font-size:15px;line-height:1.7;margin:0;">
          💡 <strong style="color:#e8e4f0;">The AI never tells you what to value</strong> — it just looks at what you're already tracking, where your streaks are, and what you told it about your day. Then it makes a call so you don't have to.
        </p>
      </div>
    </td></tr>

    <!-- CTA -->
    <tr><td style="padding-bottom:28px;text-align:center;">
      <a href="${appUrl}/dashboard"
         style="display:inline-block;background:linear-gradient(135deg,#6c63ff 0%,#9b59b6 100%);color:#fff;padding:18px 40px;border-radius:14px;text-decoration:none;font-size:17px;font-weight:700;letter-spacing:0.2px;box-shadow:0 4px 24px rgba(108,99,255,0.4);">
        🗓️ Build My Day →
      </a>
      <div style="color:#4a4860;font-size:12px;margin-top:10px;">Takes less than 30 seconds</div>
    </td></tr>

    <!-- Your orbits reminder -->
    ${orbitCount > 0 ? `
    <tr><td style="padding-bottom:24px;">
      <div style="background:#0d0d1a;border:1px solid #1a1a2e;border-radius:16px;padding:20px 24px;">
        <div style="color:#e8e4f0;font-size:14px;font-weight:600;margin-bottom:12px;">📋 Your orbits are waiting for today's check-in</div>
        <div style="margin-bottom:16px;">${orbitPreview}${userData.orbits.length > 3 ? `<span style="color:#4a4860;font-size:12px;"> +${userData.orbits.length - 3} more</span>` : ''}</div>
        <a href="${appUrl}/dashboard"
           style="display:inline-block;background:#1a1a2e;color:#6c63ff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;border:1px solid #6c63ff44;">
          Open Orbit →
        </a>
      </div>
    </td></tr>
    ` : ''}

    <!-- Footer -->
    <tr><td style="text-align:center;padding-top:8px;">
      <p style="color:#2a2848;font-size:11px;margin:0;line-height:1.8;">
        You're getting this because you use Orbit.<br>
        Keep showing up — small habits, big life. 🌱
      </p>
    </td></tr>

  </table>
  </td></tr>
</table>
</body>
</html>`.trim()

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
            subject: '🗓️ New: Build My Day — let AI plan your morning',
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

    await supabase.from('function_logs').insert({
      function_name: 'send-announcement',
      status: 'success',
      details: { sent, failed, subject: 'Build My Day Feature Launch' }
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
