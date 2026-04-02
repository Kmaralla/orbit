// One-off announcement email to all users
// Invoke with: { "testEmail": "you@example.com" } to test on one address
// Invoke with: { "send": true } to send to all users with notify_email set
// Without either: dry run — shows who would receive it

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
    let testEmail: string | null = null

    try {
      const body = await req.json()
      if (body?.send === true) actualSend = true
      if (body?.testEmail) testEmail = body.testEmail
    } catch {
      // No body = dry run
    }

    const buildEmailHtml = (appUrl: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>stop tracking noise. start ticking off wins.</title>
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
  <tr><td style="padding-bottom:24px;">
    <p style="font-size:17px;color:#1a1a2e;margin:0 0 14px 0;line-height:1.65;font-weight:400;">
      You've been tracking consistently. That's genuinely hard to keep up.
    </p>
    <p style="font-size:17px;color:#1a1a2e;margin:0 0 14px 0;line-height:1.65;">
      But we kept hearing two things: <em>"Some of my tasks, I just never do anymore"</em> — and — <em>"I have stuff to track that isn't a daily habit."</em>
    </p>
    <p style="font-size:17px;color:#1a1a2e;margin:0 0 0 0;line-height:1.65;">
      Two new features. Both built around that feedback.
    </p>
  </td></tr>

  <tr><td style="padding:4px 0 28px 0;border-top:1px solid #f0f0f5;"></td></tr>

  <!-- Feature 1: Organize -->
  <tr><td style="padding-bottom:28px;">
    <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6c63ff;margin:0 0 12px 0;">New Feature #1</p>

    <p style="font-size:19px;font-weight:800;color:#1a1a2e;margin:0 0 10px 0;line-height:1.35;letter-spacing:-0.3px;">
      🧹 Organize — your habits, honestly reviewed
    </p>
    <p style="font-size:15px;color:#444460;margin:0 0 16px 0;line-height:1.7;">
      Orbit now looks at <strong>90 days of your completion history</strong> and tells you the truth — which tasks you're actually doing, which are just sitting there at 0%, and what's worth keeping vs. letting go.
    </p>
    <p style="font-size:15px;color:#444460;margin:0 0 20px 0;line-height:1.7;">
      It gives you a health score and specific suggestions: remove tasks you've ignored for months, change a daily task to weekly if that's more realistic, or merge two overlapping orbits. One tap to apply.
    </p>

    <!-- Organize mockup -->
    <div style="background:#0d0d1a;border-radius:16px;padding:20px;margin-bottom:20px;border:1px solid #1e1e3a;">

      <!-- Health score row -->
      <div style="display:flex;align-items:center;gap:16px;background:#13131f;border:1px solid #1e1e3a;border-radius:12px;padding:14px 16px;margin-bottom:14px;">
        <div style="text-align:center;min-width:48px;">
          <div style="font-size:28px;font-weight:900;color:#f59e0b;line-height:1;font-family:-apple-system,sans-serif;">62</div>
          <div style="font-size:9px;color:#6b6b8a;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;">Health</div>
        </div>
        <div style="width:1px;height:36px;background:#1e1e3a;flex-shrink:0;"></div>
        <div style="font-size:12px;color:#a8a4c8;line-height:1.5;font-style:italic;">
          You're tracking well across 3 orbits — but 4 tasks haven't been completed in over 6 weeks.
        </div>
      </div>

      <!-- Suggestion card 1 -->
      <div style="background:#13131f;border:1px solid #1e1e3a;border-radius:12px;padding:14px 16px;margin-bottom:8px;">
        <div style="font-size:10px;font-weight:700;color:#6c63ff;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">🗑️ Remove Task · Dad's Health</div>
        <div style="font-size:13px;font-weight:700;color:#e8e4f0;margin-bottom:6px;">Archive "Blood pressure morning log"</div>
        <div style="font-size:12px;color:#6b6b8a;line-height:1.5;margin-bottom:10px;">Not completed in 47 days. Removing it reduces noise and keeps your check-ins honest.</div>
        <div style="display:flex;gap:8px;">
          <span style="font-size:11px;color:#6b6b8a;border:1px solid #2a2a44;border-radius:6px;padding:5px 10px;cursor:pointer;">Dismiss</span>
          <span style="font-size:11px;color:#fff;background:#6c63ff;border-radius:6px;padding:5px 10px;cursor:pointer;font-weight:700;">Apply</span>
        </div>
      </div>

      <!-- Suggestion card 2 -->
      <div style="background:#13131f;border:1px solid #1e1e3a;border-radius:12px;padding:14px 16px;">
        <div style="font-size:10px;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">📅 Change Frequency · Fitness</div>
        <div style="font-size:13px;font-weight:700;color:#e8e4f0;margin-bottom:6px;">Change "Full workout" from daily → weekdays</div>
        <div style="font-size:12px;color:#6b6b8a;line-height:1.5;margin-bottom:10px;">You complete this 68% of weekdays but nearly 0% on weekends. Match your schedule to reality.</div>
        <div style="display:flex;gap:8px;">
          <span style="font-size:11px;color:#6b6b8a;border:1px solid #2a2a44;border-radius:6px;padding:5px 10px;">Dismiss</span>
          <span style="font-size:11px;color:#fff;background:#6c63ff;border-radius:6px;padding:5px 10px;font-weight:700;">Apply</span>
        </div>
      </div>

    </div>

    <p style="font-size:14px;color:#555570;margin:0;line-height:1.7;">
      Find it on your dashboard → <strong>🧹 Organize</strong>. Appears once you have 2+ orbits.
    </p>
  </td></tr>

  <tr><td style="padding:4px 0 28px 0;border-top:1px solid #f0f0f5;"></td></tr>

  <!-- Feature 2: Side Quests -->
  <tr><td style="padding-bottom:28px;">
    <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6c63ff;margin:0 0 12px 0;">New Feature #2</p>

    <p style="font-size:19px;font-weight:800;color:#1a1a2e;margin:0 0 10px 0;line-height:1.35;letter-spacing:-0.3px;">
      ☄️ Side Quests — one-time tasks, no frequency needed
    </p>
    <p style="font-size:15px;color:#444460;margin:0 0 14px 0;line-height:1.7;">
      Some things just need to get done <em>once</em>. They don't belong in a daily orbit. They just need a place to live until you tick them off.
    </p>
    <p style="font-size:15px;color:#444460;margin:0 0 6px 0;line-height:1.7;">
      Things like:
    </p>
    <p style="font-size:14px;color:#555570;margin:0 0 4px 0;line-height:1.8;">
      &nbsp;&nbsp;🏠 &nbsp;<em>Search for a new house</em>
    </p>
    <p style="font-size:14px;color:#555570;margin:0 0 4px 0;line-height:1.8;">
      &nbsp;&nbsp;🔋 &nbsp;<em>Fix the smoke alarm battery</em>
    </p>
    <p style="font-size:14px;color:#555570;margin:0 0 20px 0;line-height:1.8;">
      &nbsp;&nbsp;📞 &nbsp;<em>Call the insurance company</em>
    </p>

    <!-- Side quest mockup -->
    <div style="background:#0d0d1a;border-radius:16px;padding:20px;margin-bottom:20px;border:1px solid #1e1e3a;">
      <div style="font-size:14px;font-weight:800;color:#e8e4f0;margin-bottom:4px;">☄️ Side Quests</div>
      <div style="font-size:11px;color:#6b6b8a;margin-bottom:16px;">3 open · 2 done</div>

      <!-- Quest items -->
      <div style="background:#13131f;border:1px solid #1e1e3a;border-radius:10px;padding:10px 12px;margin-bottom:6px;display:flex;align-items:center;gap:10px;">
        <div style="width:18px;height:18px;border-radius:50%;border:2px solid #2a2a44;flex-shrink:0;"></div>
        <span style="font-size:13px;color:#e8e4f0;font-weight:600;">Search for a new house</span>
      </div>
      <div style="background:#13131f;border:1px solid #1e1e3a;border-radius:10px;padding:10px 12px;margin-bottom:6px;display:flex;align-items:center;gap:10px;">
        <div style="width:18px;height:18px;border-radius:50%;border:2px solid #2a2a44;flex-shrink:0;"></div>
        <span style="font-size:13px;color:#e8e4f0;font-weight:600;">Fix smoke alarm battery</span>
      </div>
      <div style="background:#13131f;border:1px solid rgba(34,197,94,0.3);border-radius:10px;padding:10px 12px;margin-bottom:6px;display:flex;align-items:center;gap:10px;opacity:0.65;">
        <div style="width:18px;height:18px;border-radius:50%;border:2px solid #22c55e;background:#22c55e;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
          <span style="color:#fff;font-size:10px;font-weight:700;">✓</span>
        </div>
        <span style="font-size:13px;color:#6b6b8a;font-weight:600;text-decoration:line-through;">Buy laptop charger</span>
      </div>
    </div>

    <p style="font-size:14px;color:#555570;margin:0;line-height:1.7;">
      The <strong>☄️ Side Quests</strong> panel lives on the right edge of your dashboard — always one tap away. Add a task, check it off, and move on.
    </p>
  </td></tr>

  <tr><td style="padding:4px 0 28px 0;border-top:1px solid #f0f0f5;"></td></tr>

  <!-- CTA -->
  <tr><td style="padding-bottom:28px;">
    <a href="${appUrl}/dashboard"
       style="display:inline-block;background:#6c63ff;color:#ffffff;padding:14px 28px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:700;letter-spacing:0.1px;">
      Open Orbit →
    </a>
  </td></tr>

  <!-- Sign-off -->
  <tr><td style="border-top:1px solid #f0f0f5;">
    <p style="font-size:14px;color:#555570;margin:16px 0 4px 0;line-height:1.6;">
      As always — building this for the people who actually use it. If something feels off or you want something different, just reply to this email.<br><br>
      — Karthiek
    </p>
    <p style="font-size:12px;color:#aaa8be;margin:12px 0 0 0;line-height:1.7;">
      You're getting this because you use Orbit. That's it. No fluff.
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`.trim()

    // ── Test mode: send to a single email ───────────────────────────
    if (testEmail) {
      const html = buildEmailHtml(appUrl)
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Karthiek from Orbit <hello@orbityours.com>',
          to: testEmail,
          subject: 'stop tracking noise. start ticking off wins.',
          html,
        }),
      })
      const data = await response.json()
      return new Response(
        JSON.stringify({ testMode: true, to: testEmail, ok: response.ok, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Get all users with notify_email ─────────────────────────────
    const { data: usecases } = await supabase
      .from('usecases')
      .select('notify_email')
      .not('notify_email', 'is', null)

    const emails = [...new Set((usecases || []).map(uc => uc.notify_email))]

    if (!actualSend) {
      return new Response(
        JSON.stringify({
          dryRun: true,
          message: 'Pass { "testEmail": "you@example.com" } to test, or { "send": true } to send to all',
          wouldSendTo: emails,
          totalUsers: emails.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Send to all ─────────────────────────────────────────────────
    const results: { email: string; status: string; error?: string }[] = []
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i]
      if (i > 0) await sleep(5000)

      const html = buildEmailHtml(appUrl)
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
            subject: 'stop tracking noise. start ticking off wins.',
            html,
          }),
        })
        const responseData = await response.json()
        if (!response.ok) {
          results.push({ email, status: 'failed', error: responseData.message })
        } else {
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
      details: { sent, failed, subject: 'stop tracking noise. start ticking off wins.' }
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
