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
  <title>the moment you actually finish a goal</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:36px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:500px;">

  <!-- Logo -->
  <tr><td style="padding-bottom:28px;">
    <span style="font-size:17px;font-weight:700;color:#1a1a2e;letter-spacing:-0.3px;">
      <span style="color:#6c63ff;">●</span> Orbit
    </span>
  </td></tr>

  <!-- Opening -->
  <tr><td style="padding-bottom:20px;">
    <p style="font-size:17px;color:#1a1a2e;margin:0 0 14px 0;line-height:1.65;font-weight:400;">
      There's a specific feeling when you actually finish something you set out to do.
    </p>
    <p style="font-size:17px;color:#1a1a2e;margin:0 0 14px 0;line-height:1.65;">
      Not just crossing it off a to-do list. But genuinely closing a chapter — <em>"I showed up. I did the work. It's done."</em>
    </p>
    <p style="font-size:17px;color:#1a1a2e;margin:0 0 0 0;line-height:1.65;">
      That moment deserves more than just deleting an app or archiving a note. We wanted to give it a proper ceremony.
    </p>
  </td></tr>

  <tr><td style="padding:8px 0 24px 0;border-top:1px solid #f0f0f5;border-bottom:none;"></td></tr>

  <!-- Feature: Close Orbit -->
  <tr><td style="padding-bottom:24px;">
    <p style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6c63ff;margin:0 0 14px 0;">New in Orbit</p>

    <p style="font-size:17px;font-weight:700;color:#1a1a2e;margin:0 0 10px 0;line-height:1.4;">
      🏁 Close an Orbit — with a proper celebration
    </p>
    <p style="font-size:15px;color:#444460;margin:0 0 16px 0;line-height:1.7;">
      You can now set a goal end date on any orbit. When that date arrives, Orbit taps you on the shoulder and asks: <strong>did you achieve it?</strong>
    </p>
    <p style="font-size:15px;color:#444460;margin:0 0 20px 0;line-height:1.7;">
      If yes — you get the moment you earned. Your stats appear: how many days you showed up, your best streak, completion rate. And a screen that says, plainly: <strong>Goal Achieved.</strong>
    </p>

    <!-- Celebration mockup -->
    <div style="background:linear-gradient(135deg,#1a3a1a,#0d1a0d);border-radius:16px;padding:28px 24px;text-align:center;margin-bottom:20px;">
      <div style="font-size:48px;margin-bottom:10px;">🏆</div>
      <div style="font-size:20px;font-weight:800;color:#22c55e;margin-bottom:6px;font-family:-apple-system,sans-serif;">Goal Achieved!</div>
      <div style="font-size:14px;color:#86efac;margin-bottom:18px;line-height:1.5;">You did it. Your orbit is complete.</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="33%" style="text-align:center;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:10px;padding:12px 6px;">
            <div style="font-size:20px;font-weight:800;color:#22c55e;font-family:-apple-system,sans-serif;">21</div>
            <div style="font-size:10px;color:#86efac;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;">best streak</div>
          </td>
          <td width="4%"></td>
          <td width="33%" style="text-align:center;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:10px;padding:12px 6px;">
            <div style="font-size:20px;font-weight:800;color:#22c55e;font-family:-apple-system,sans-serif;">28</div>
            <div style="font-size:10px;color:#86efac;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;">days tracked</div>
          </td>
          <td width="4%"></td>
          <td width="33%" style="text-align:center;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:10px;padding:12px 6px;">
            <div style="font-size:20px;font-weight:800;color:#22c55e;font-family:-apple-system,sans-serif;">84%</div>
            <div style="font-size:10px;color:#86efac;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;">completion</div>
          </td>
        </tr>
      </table>
      <div style="font-size:13px;color:#4ade80;margin-top:16px;line-height:1.7;">28 days of showing up.<br>That's what builds a life.</div>
    </div>

    <p style="font-size:15px;color:#444460;margin:0 0 14px 0;line-height:1.7;">
      And if you didn't quite get there? That's okay too. Orbit closes with grace — shows what you <em>did</em> build, and reminds you that every attempt lays the foundation for the next one.
    </p>
    <p style="font-size:15px;color:#444460;margin:0 0 0 0;line-height:1.7;">
      You can also extend the end date if you need more time. No judgment. Just flexibility.
    </p>
  </td></tr>

  <tr><td style="padding:4px 0 24px 0;border-top:1px solid #f0f0f5;"></td></tr>

  <!-- How to use it -->
  <tr><td style="padding-bottom:24px;">
    <p style="font-size:14px;font-weight:700;color:#1a1a2e;margin:0 0 12px 0;">How to try it</p>
    <p style="font-size:14px;color:#555570;margin:0 0 6px 0;line-height:1.7;">
      1. Open any orbit → hit ⚙️ Edit → add a <strong>Goal end date</strong>
    </p>
    <p style="font-size:14px;color:#555570;margin:0 0 6px 0;line-height:1.7;">
      2. When the date arrives, you'll see a <strong>🏁 Close or extend</strong> prompt on your dashboard
    </p>
    <p style="font-size:14px;color:#555570;margin:0 0 20px 0;line-height:1.7;">
      3. Tell Orbit whether you achieved it — and if you did, take a moment to actually feel it
    </p>
    <a href="${appUrl}/dashboard"
       style="display:inline-block;background:#6c63ff;color:#ffffff;padding:13px 26px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:0.1px;">
      Open Orbit →
    </a>
  </td></tr>

  <!-- Sign-off -->
  <tr><td style="padding-top:8px;border-top:1px solid #f0f0f5;">
    <p style="font-size:14px;color:#555570;margin:16px 0 4px 0;line-height:1.6;">
      The small act of saying <em>"I finished this"</em> is underrated. We hope this helps.<br><br>
      — Karthiek
    </p>
    <p style="font-size:12px;color:#aaa8be;margin:12px 0 0 0;line-height:1.7;">
      You're getting this because you use Orbit. That's it.
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
            from: 'Karthiek from Orbit <hello@orbityours.com>',
            to: email,
            subject: 'the moment you actually finish a goal',
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
      details: { sent, failed, subject: 'the moment you actually finish a goal' }
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
