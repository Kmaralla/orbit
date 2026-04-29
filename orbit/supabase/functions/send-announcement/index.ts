// Re-engagement email — personalized per user with real habit data
// Invoke with: { "testEmail": "you@example.com" } to test on one address
// Invoke with: { "send": true } to send to all users with notify_email set
// Without either: dry run — shows who would receive it

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUBJECT = `Something Changed in the Last 30 Days. You Should See It.`

// Emails that already received this announcement in the first send (Apr 12 2026)
// Hardcoded so they're never double-sent even before log-based dedup kicks in
const FIRST_SEND_EMAILS = new Set([
  'poornima.maralla@gmail.com',
  'marella.karthik@gmail.com',
  'abheek.pm@gmail.com',
  'haran.s87@gmail.com',
  'pisces.nithin@gmail.com',
  'chandrakala89.karthiek@gmail.com',
  'ptoshni2@asu.edu',
  'ta.dannylo@gmail.com',
  'phaneendran.gitam@gmail.com',
  'akira.dandi@gmail.com',
  'danny.lo@fincastai.io',
  'katari.kathyayani@gmail.com',
])

function getLocalDate(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())
  } catch { return new Date().toISOString().split('T')[0] }
}

function buildEmailHtml(appUrl: string, insights: {
  activeDays: number
  bestOrbit: { name: string; icon: string; rate: number } | null
  weakOrbit: { name: string; icon: string; rate: number } | null
  streak: number
  totalOrbits: number
}) {
  const { activeDays, bestOrbit, weakOrbit, streak, totalOrbits } = insights

  // Opening — personal, varies by engagement
  let personalOpener: string
  if (activeDays >= 20) {
    personalOpener = `You've checked in <strong>${activeDays} days</strong> in the last 30. That's not luck — that's a system working. Here's an honest look at what it's building.`
  } else if (activeDays >= 10) {
    personalOpener = `You've shown up <strong>${activeDays} days</strong> in the last 30. Solid. Not perfect — but that's not the game. The game is: can you make next month look slightly better than this one?`
  } else if (activeDays >= 3) {
    personalOpener = `You've logged <strong>${activeDays} days</strong> in the last 30. Life happens. The streak isn't the point — the fact that you're still here is. Here's what's worth refocusing on.`
  } else {
    personalOpener = `It's been a quiet stretch — <strong>${activeDays > 0 ? `${activeDays} check-in${activeDays !== 1 ? 's' : ''}` : 'no check-ins'}</strong> in the last 30 days. No judgment. But the things you set out to track? They're still waiting. Let's reset.`
  }

  const streakMsg = streak >= 7
    ? `🔥 <strong>${streak}-day streak</strong> — don't break this.`
    : streak >= 3
    ? `🔥 <strong>${streak}-day streak</strong> going. Keep the thread alive.`
    : streak === 1 ? `You checked in today. That's a streak starting.`
    : `No active streak right now — every streak starts with one day.`

  const bestCard = bestOrbit ? `
  <tr><td style="padding:0 0 10px 0;">
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px;padding:16px 18px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#16a34a;margin-bottom:10px;">🏆 Where You're Crushing It</div>
      <div style="font-size:22px;display:inline;">${bestOrbit.icon || '🎯'}&nbsp;</div>
      <span style="font-size:15px;font-weight:800;color:#1a1a2e;">${bestOrbit.name}</span>
      <div style="font-size:13px;color:#16a34a;font-weight:600;margin-top:4px;">${bestOrbit.rate}% completion this month — this orbit is locked in.</div>
    </div>
  </td></tr>` : ''

  const weakCard = weakOrbit && weakOrbit.rate < 50 ? `
  <tr><td style="padding:0 0 10px 0;">
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;padding:16px 18px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#ea580c;margin-bottom:10px;">⚡ Where to Focus Next</div>
      <div style="font-size:22px;display:inline;">${weakOrbit.icon || '🎯'}&nbsp;</div>
      <span style="font-size:15px;font-weight:800;color:#1a1a2e;">${weakOrbit.name}</span>
      <div style="font-size:13px;color:#ea580c;font-weight:600;margin-top:4px;">${weakOrbit.rate}% completion — one more check-in a day here changes the number fast.</div>
    </div>
  </td></tr>` : ''

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${SUBJECT}</title>
</head>
<body style="margin:0;padding:0;background:#faf9ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9ff;padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:500px;">

  <!-- Logo -->
  <tr><td style="padding-bottom:24px;">
    <span style="font-size:15px;font-weight:700;color:#1a1a2e;">
      <span style="color:#6c63ff;">●</span> Orbit
    </span>
  </td></tr>

  <!-- Hero card -->
  <tr><td style="padding-bottom:16px;">
    <div style="background:#ffffff;border-radius:20px;padding:28px;border:1px solid #e8e4f0;">
      <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#6c63ff;margin:0 0 12px 0;">Your last 30 days, honestly</p>
      <h1 style="font-size:22px;font-weight:900;color:#1a1a2e;margin:0 0 16px 0;line-height:1.3;letter-spacing:-0.3px;">
        Most people don't quit on bad days.<br>They quit on good ones.
      </h1>
      <p style="font-size:15px;color:#374151;margin:0;line-height:1.75;">${personalOpener}</p>
    </div>
  </td></tr>

  <!-- Stats row -->
  <tr><td style="padding-bottom:16px;">
    <div style="background:#ffffff;border-radius:20px;padding:24px 28px;border:1px solid #e8e4f0;">
      <p style="font-size:12px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 14px 0;">Your numbers</p>
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="text-align:center;padding:12px;background:#f8f7ff;border-radius:12px;">
          <div style="font-size:30px;font-weight:900;color:#6c63ff;line-height:1;">${activeDays}</div>
          <div style="font-size:10px;color:#9ca3af;margin-top:4px;text-transform:uppercase;letter-spacing:0.5px;">Days active</div>
        </td>
        <td style="width:10px;"></td>
        <td style="text-align:center;padding:12px;background:#f8f7ff;border-radius:12px;">
          <div style="font-size:30px;font-weight:900;color:#6c63ff;line-height:1;">${streak}</div>
          <div style="font-size:10px;color:#9ca3af;margin-top:4px;text-transform:uppercase;letter-spacing:0.5px;">Day streak</div>
        </td>
        <td style="width:10px;"></td>
        <td style="text-align:center;padding:12px;background:#f8f7ff;border-radius:12px;">
          <div style="font-size:30px;font-weight:900;color:#6c63ff;line-height:1;">${totalOrbits}</div>
          <div style="font-size:10px;color:#9ca3af;margin-top:4px;text-transform:uppercase;letter-spacing:0.5px;">Orbits</div>
        </td>
      </tr></table>
      <p style="font-size:13px;color:#6b7280;margin:12px 0 0 0;line-height:1.6;">${streakMsg}</p>
    </div>
  </td></tr>

  <!-- Orbit insight cards -->
  ${bestCard || weakCard ? `
  <tr><td style="padding-bottom:16px;">
    <div style="background:#ffffff;border-radius:20px;padding:24px 28px;border:1px solid #e8e4f0;">
      <p style="font-size:12px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 14px 0;">Your orbit breakdown</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${bestCard}
        ${weakCard}
      </table>
    </div>
  </td></tr>` : ''}

  <!-- The compound effect visual -->
  <tr><td style="padding-bottom:16px;">
    <div style="background:#ffffff;border-radius:20px;padding:24px 28px;border:1px solid #e8e4f0;">
      <p style="font-size:12px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 14px 0;">Why consistency beats perfection</p>
      <p style="font-size:15px;color:#374151;margin:0 0 16px 0;line-height:1.75;">Tracking at 70% for 6 months beats tracking at 100% for 3 weeks then quitting. Every single time.</p>

      <p style="font-size:11px;color:#9ca3af;margin:0 0 5px 0;">Alex — "perfect or nothing" → quit week 3</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;"><tr>
        ${Array.from({length: 13}, (_, i) => `<td style="padding:0 1px;"><div style="height:14px;background:${i < 2 ? '#22c55e' : i === 2 ? '#f59e0b' : '#f3f4f6'};border-radius:2px;"></div></td>`).join('')}
      </tr></table>

      <p style="font-size:11px;color:#6c63ff;font-weight:600;margin:0 0 5px 0;">Jordan — "just show up" → still going at month 6</p>
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        ${Array.from({length: 13}, (_, i) => {
          const filled = [0,1,3,4,6,7,8,10,11,12].includes(i)
          return `<td style="padding:0 1px;"><div style="height:14px;background:${filled ? '#6c63ff' : '#ede9fe'};border-radius:2px;"></div></td>`
        }).join('')}
      </tr></table>
    </div>
  </td></tr>

  <!-- 3 tips -->
  <tr><td style="padding-bottom:16px;">
    <div style="background:#ffffff;border-radius:20px;padding:24px 28px;border:1px solid #e8e4f0;">
      <p style="font-size:12px;font-weight:700;color:#6c63ff;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 18px 0;">3 ways to make showing up effortless</p>

      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding-bottom:16px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:36px;vertical-align:top;">
              <div style="width:32px;height:32px;background:#f0eeff;border-radius:8px;text-align:center;line-height:32px;font-size:15px;">🗓️</div>
            </td>
            <td style="padding-left:12px;">
              <div style="font-size:14px;font-weight:700;color:#1a1a2e;margin-bottom:3px;">Plan My Day — commit to less, do more</div>
              <div style="font-size:13px;color:#6b7280;line-height:1.6;">Cherry-pick which tasks you're doing today. No pressure to do everything — just what's realistic right now.</div>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding-bottom:16px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:36px;vertical-align:top;">
              <div style="width:32px;height:32px;background:#f0eeff;border-radius:8px;text-align:center;line-height:32px;font-size:15px;">✓</div>
            </td>
            <td style="padding-left:12px;">
              <div style="font-size:14px;font-weight:700;color:#1a1a2e;margin-bottom:3px;">"I showed up" — one tap on a hard day</div>
              <div style="font-size:13px;color:#6b7280;line-height:1.6;">Too busy to log each item? Hit mark all done inside any orbit. The streak stays. Progress keeps moving.</div>
            </td>
          </tr></table>
        </td></tr>
        <tr><td>
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:36px;vertical-align:top;">
              <div style="width:32px;height:32px;background:#f0eeff;border-radius:8px;text-align:center;line-height:32px;font-size:15px;">🧹</div>
            </td>
            <td style="padding-left:12px;">
              <div style="font-size:14px;font-weight:700;color:#1a1a2e;margin-bottom:3px;">Organize — cut tasks that aren't serving you</div>
              <div style="font-size:13px;color:#6b7280;line-height:1.6;">Orbit looks at 90 days of history and tells you what to drop. Fewer tasks = more focus on what actually matters.</div>
            </td>
          </tr></table>
        </td></tr>
      </table>
    </div>
  </td></tr>

  <!-- CTA — solid color, no gradient -->
  <tr><td style="padding-bottom:28px;">
    <div style="background:#6c63ff;border-radius:20px;padding:28px;text-align:center;">
      <p style="font-size:20px;font-weight:900;color:#ffffff;margin:0 0 8px 0;line-height:1.3;letter-spacing:-0.3px;">Do one check-in today.</p>
      <p style="font-size:14px;color:rgba(255,255,255,0.8);margin:0 0 20px 0;line-height:1.6;">Not a restart. Just open one orbit and log one thing.</p>
      <a href="${appUrl}/dashboard" style="display:inline-block;background:#ffffff;color:#6c63ff;padding:13px 30px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:800;">Open Orbit →</a>
    </div>
  </td></tr>

  <!-- Sign-off -->
  <tr><td style="text-align:center;padding-bottom:28px;">
    <p style="font-size:14px;color:#9ca3af;margin:0;line-height:1.8;">
      — Karthiek<br>
      <span style="font-size:12px;">Building Orbit because I needed it too.</span>
    </p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="border-top:1px solid #e8e4f0;padding-top:18px;text-align:center;">
    <p style="font-size:11px;color:#c4c0d8;margin:0;line-height:1.7;">
      You're getting this because you use Orbit. No spam, ever.
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
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

    if (!supabaseUrl || !supabaseServiceKey || !resendApiKey) throw new Error('Missing env vars')

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let actualSend = false
    let testEmail: string | null = null
    try {
      const body = await req.json()
      if (body?.send === true) actualSend = true
      if (body?.testEmail) testEmail = body.testEmail
    } catch { /* dry run */ }

    // ── Fetch ALL signed-up users from auth.users ───────────────────
    // This catches users who never set notify_email on their orbits
    const { data: { users: authUsers } } = await supabase.auth.admin.listUsers({ perPage: 1000 })

    if (!authUsers?.length) {
      return new Response(JSON.stringify({ message: 'No users', sent: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Fetch all active orbits (any user)
    const { data: usecases } = await supabase
      .from('usecases')
      .select('id, user_id, name, icon, timezone')
      .is('closed_at', null)

    // Group by auth user email
    const byEmail: Record<string, { userId: string; timezone: string; orbits: typeof usecases }> = {}
    for (const user of authUsers) {
      if (!user.email) continue
      if (testEmail && user.email !== testEmail) continue
      const userOrbits = (usecases || []).filter(uc => uc.user_id === user.id)
      const tz = userOrbits.find(uc => uc.timezone)?.timezone || 'Asia/Kolkata'
      byEmail[user.email] = { userId: user.id, timezone: tz, orbits: userOrbits }
    }

    // ── Check who already received this exact announcement ──────────
    const { data: priorLogs } = await supabase
      .from('function_logs')
      .select('details')
      .eq('function_name', 'send-announcement')
      .eq('status', 'success')

    const alreadySent = new Set<string>([...FIRST_SEND_EMAILS])
    for (const log of priorLogs || []) {
      const sentEmails: string[] = log.details?.sentEmails || []
      for (const e of sentEmails) alreadySent.add(e)
    }

    const allEmails = Object.keys(byEmail)
    const emailsToSend = testEmail
      ? allEmails  // test mode: always send regardless
      : allEmails.filter(e => !alreadySent.has(e))
    const skipped = allEmails.filter(e => alreadySent.has(e))

    if (!actualSend && !testEmail) {
      return new Response(
        JSON.stringify({
          dryRun: true,
          subject: SUBJECT,
          wouldSendTo: emailsToSend,
          alreadySent: [...alreadySent].filter(e => allEmails.includes(e)),
          skipped,
          totalNew: emailsToSend.length,
          totalAll: allEmails.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (emailsToSend.length === 0) {
      return new Response(JSON.stringify({ message: 'Everyone already received this announcement', skipped }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Fetch 30 days of entries for all relevant users
    const userIds = [...new Set(Object.values(byEmail).map(u => u.userId))]
    const orbitIds = (usecases || []).filter(uc => userIds.includes(uc.user_id)).map(uc => uc.id)

    const { data: allItems } = await supabase
      .from('checklist_items')
      .select('id, usecase_id')
      .in('usecase_id', orbitIds)

    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const { data: entries } = await supabase
      .from('checkin_entries')
      .select('checklist_item_id, user_id, date, value')
      .in('user_id', userIds)
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0])

    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
    const results: { email: string; status: string; error?: string }[] = []

    for (let i = 0; i < emailsToSend.length; i++) {
      const email = emailsToSend[i]
      if (i > 0) await sleep(6000)

      const { userId, timezone, orbits } = byEmail[email]
      const today = getLocalDate(timezone)

      // Per-orbit completion rates (last 30 days)
      const orbitStats = orbits.map(orbit => {
        const itemIds = (allItems || []).filter(it => it.usecase_id === orbit.id).map(it => it.id)
        const orbitEntries = (entries || []).filter(e => e.user_id === userId && itemIds.includes(e.checklist_item_id))
        const doneDates = new Set(orbitEntries.filter(e => e.value && e.value !== '' && e.value !== 'false').map(e => e.date))
        const rate = Math.round((doneDates.size / 30) * 100)
        return { orbit, rate, doneDates }
      })

      // Total unique active days across all orbits
      const allDoneDates = new Set(orbitStats.flatMap(os => [...os.doneDates]))
      const activeDays = allDoneDates.size

      // Current streak (working backwards from today)
      let streak = 0
      const d = new Date(today)
      while (true) {
        const ds = d.toISOString().split('T')[0]
        if (allDoneDates.has(ds)) { streak++; d.setDate(d.getDate() - 1) }
        else break
        if (streak > 365) break
      }

      // Best and weakest orbits
      const sorted = [...orbitStats].sort((a, b) => b.rate - a.rate)
      const bestOrbit = sorted[0] ? { name: sorted[0].orbit.name, icon: sorted[0].orbit.icon, rate: sorted[0].rate } : null
      const weakOrbit = sorted.length > 1 ? { name: sorted[sorted.length - 1].orbit.name, icon: sorted[sorted.length - 1].orbit.icon, rate: sorted[sorted.length - 1].rate } : null

      const html = buildEmailHtml(appUrl, { activeDays, bestOrbit, weakOrbit, streak, totalOrbits: orbits.length })

      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Karthiek from Orbit <hello@orbityours.com>',
            to: testEmail || email,
            subject: SUBJECT,
            html,
          }),
        })
        const data = await res.json()
        results.push({ email, status: res.ok ? 'sent' : 'failed', error: res.ok ? undefined : data.message })
      } catch (err) {
        results.push({ email, status: 'error', error: String(err) })
      }
    }

    const sent = results.filter(r => r.status === 'sent').length
    const successEmails = results.filter(r => r.status === 'sent').map(r => r.email)

    // Log individual sent emails so future runs can skip them
    if (!testEmail && successEmails.length > 0) {
      await supabase.from('function_logs').insert({
        function_name: 'send-announcement',
        status: 'success',
        details: { sent, total: emailsToSend.length, subject: SUBJECT, sentEmails: successEmails }
      })
    }

    return new Response(JSON.stringify({ success: true, sent, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})
