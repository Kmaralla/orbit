// Supabase Edge Function: Weekly Summary Email
// Schedule: Every Monday 8am UTC  →  0 8 * * 1
//
// Test single user:  GET /send-weekly-summary?email=user@example.com
// Send to all:       GET /send-weekly-summary  (no param)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Stats ─────────────────────────────────────────────────────────────────────

function computeOrbitStats(orbit: any, items: any[], entries: any[], weekStart: string) {
  const orbitItems = items.filter(i => i.usecase_id === orbit.id)
  if (!orbitItems.length) return null

  const itemStats = orbitItems.map(item => {
    const itemEntries = entries.filter(e => e.checklist_item_id === item.id)
    const doneEntries = itemEntries.filter(e => e.value && e.value !== '' && e.value !== 'false')
    const daysCompleted = doneEntries.length

    const sortedDates = itemEntries.map(e => e.date).sort().reverse()
    const lastDate = sortedDates[0]
    const today = new Date().toISOString().split('T')[0]
    const daysSinceLast = lastDate
      ? Math.floor((new Date(today).getTime() - new Date(lastDate).getTime()) / 86400000)
      : 99

    // For score/number: average value
    let avgValue: number | null = null
    if (item.value_type === 'score' || item.value_type === 'number') {
      const nums = doneEntries.map(e => Number(e.value)).filter(n => !isNaN(n) && n > 0)
      avgValue = nums.length > 0 ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null
    }

    return { label: item.label, value_type: item.value_type, daysCompleted, daysSinceLast, avgValue }
  })

  const totalPossible = orbitItems.length * 7
  const totalDone = itemStats.reduce((s, i) => s + i.daysCompleted, 0)
  const completionPct = totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0
  const daysActive = new Set(
    entries.filter(e => orbitItems.some(i => i.id === e.checklist_item_id)).map(e => e.date)
  ).size

  const zone: 'win' | 'watch' | 'focus' =
    completionPct >= 65 ? 'win' : completionPct >= 35 ? 'watch' : 'focus'

  return { orbit, completionPct, daysActive, itemStats, zone }
}

// ── Claude ────────────────────────────────────────────────────────────────────

async function getInsights(
  userName: string,
  orbitStats: ReturnType<typeof computeOrbitStats>[],
  totalDaysActive: number,
  isNewUser: boolean,
  anthropicKey: string
) {
  const validStats = orbitStats.filter(Boolean) as NonNullable<ReturnType<typeof computeOrbitStats>>[]

  const dataLines = validStats.map(s => {
    const items = s.itemStats.map(i => {
      const extra = i.avgValue !== null ? `, avg ${i.avgValue}` : ''
      const last = i.daysSinceLast === 0 ? 'today' : i.daysSinceLast === 99 ? 'never this week' : `${i.daysSinceLast}d ago`
      return `    • ${i.label}: ${i.daysCompleted}/7 days${extra}, last: ${last}`
    }).join('\n')
    return `${s.orbit.icon} ${s.orbit.name} — ${s.completionPct}% (${s.daysActive}/7 days active)\n${items}`
  }).join('\n\n')

  const segment = isNewUser
    ? 'NEW_USER (just started this week — low data is totally normal, focus on encouragement and momentum)'
    : totalDaysActive === 0
      ? 'DORMANT (has orbits but no check-ins at all this week — gentle nudge, no guilt)'
      : totalDaysActive >= 5
        ? 'ACTIVE_STRONG (checked in 5-7 days — acknowledge it, push them a little further)'
        : 'ACTIVE_PARTIAL (checked in 2-4 days — honest about the gap, warm about what they did do)'

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: `You write weekly progress emails for ${userName}, a user of Orbit (a personal habit/life-tracking app).

Tone: warm and direct, like a friend who actually pays attention — not a bot, not a cheerleader, not corporate. Be honest. Reference specific numbers or orbit names when you can. Keep each field SHORT.

User segment: ${segment}

Return ONLY valid JSON — no markdown, no extra text:
{
  "subject": "email subject line, sentence case (capitalize first word), max 9 words, punchy and specific — use actual numbers or orbit names if possible. Examples of good styles: 'You showed up 5 days last week', 'Your streak is real — keep it going', 'One habit slipped. Here is how to fix it', 'Dad's Health is on a 12-day streak'. No generic phrases like 'weekly summary' or 'check in'. Make them want to open it.",
  "openingLine": "2 sentences max. Direct observation about their week. Name their best or most active orbit if possible.",
  "winLine": "1 sentence. Specific praise. Call out actual numbers or orbit names.",
  "watchLine": "1 sentence. What slipped or what needs watching. Honest but not harsh.",
  "focusAction": "1 specific thing to do this week. Concrete, not vague.",
  "closingLine": "1 short sentence. Grounded motivation. No clichés like 'you got this' or 'keep it up'."
}`,
      messages: [{
        role: 'user',
        content: validStats.length
          ? `Check-in data for the past 7 days:\n\n${dataLines}\n\nTotal days with any check-in: ${totalDaysActive}/7`
          : `This user has ${orbitStats.length} orbit${orbitStats.length !== 1 ? 's' : ''} but no check-ins recorded this week. They are ${isNewUser ? 'brand new' : 'returning but inactive'}.`,
      }],
    }),
  })

  const data = await response.json()
  const text = data.content?.find((b: any) => b.type === 'text')?.text || '{}'
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch {
    return {
      subject: 'your week with orbit',
      openingLine: 'Another week in orbit. Here\'s how it went.',
      winLine: 'You kept your tracking alive — that\'s not nothing.',
      watchLine: 'Some orbits need more consistent attention.',
      focusAction: 'Pick one orbit and check in every single day this week.',
      closingLine: 'What gets tracked, gets better.',
    }
  }
}

// ── Email HTML ─────────────────────────────────────────────────────────────────

function buildEmail(insights: any, orbitStats: any[], totalDaysActive: number, appUrl: string): string {
  const ZONES: Record<string, { bg: string; border: string; color: string; tag: string }> = {
    win:   { bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d', tag: '● On track' },
    watch: { bg: '#fffbeb', border: '#fde68a', color: '#92400e', tag: '◐ Keep it up' },
    focus: { bg: '#fef2f2', border: '#fecaca', color: '#991b1b', tag: '○ Needs attention' },
  }

  const validStats = orbitStats.filter(Boolean)
  const progressPct = Math.round((totalDaysActive / 7) * 100)

  const orbitCards = validStats.map((s: any) => {
    const z = ZONES[s.zone]
    const itemRows = s.itemStats.slice(0, 4).map((item: any) => {
      // 7 dots showing each day
      const dots = Array.from({ length: 7 }, (_, d) =>
        `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${d < item.daysCompleted ? '#6c63ff' : '#e5e7eb'};margin-right:2px;"></span>`
      ).join('')
      const valueNote = item.avgValue !== null ? ` · avg ${item.avgValue}` : ''
      return `<tr>
        <td style="padding:4px 0;font-size:12px;color:#374151;width:55%;">${item.label}${valueNote}</td>
        <td style="padding:4px 0;text-align:right;">${dots}</td>
      </tr>`
    }).join('')

    return `<div style="background:${z.bg};border:1px solid ${z.border};border-radius:12px;padding:14px 16px;margin-bottom:10px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
        <tr>
          <td style="font-size:14px;font-weight:700;color:#111827;">${s.orbit.icon} ${s.orbit.name}</td>
          <td style="text-align:right;font-size:11px;font-weight:700;color:${z.color};">${z.tag}</td>
        </tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0">${itemRows}</table>
    </div>`
  }).join('')

  const progressBar = totalDaysActive > 0
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:4px;">
        <tr>
          <td style="background:#f3f4f6;border-radius:6px;height:5px;">
            <div style="background:#6c63ff;border-radius:6px;height:5px;width:${progressPct}%;"></div>
          </td>
        </tr>
      </table>
      <p style="font-size:11px;color:#9ca3af;margin:0 0 16px 0;">${totalDaysActive} of 7 days active this week</p>`
    : `<p style="font-size:13px;color:#9ca3af;margin:0 0 16px 0;">No check-ins recorded this week</p>`

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:36px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">

  <!-- Logo -->
  <tr><td style="padding-bottom:24px;">
    <span style="font-size:16px;font-weight:700;color:#1a1a2e;letter-spacing:-0.3px;">
      <span style="color:#6c63ff;">●</span> Orbit
    </span>
    <span style="font-size:11px;color:#9ca3af;margin-left:8px;text-transform:uppercase;letter-spacing:1px;">weekly</span>
  </td></tr>

  <!-- Opening -->
  <tr><td style="padding-bottom:16px;">
    <p style="font-size:16px;color:#111827;margin:0 0 12px 0;line-height:1.65;">${insights.openingLine}</p>
    ${progressBar}
  </td></tr>

  <!-- Orbit cards -->
  ${validStats.length ? `<tr><td style="padding-bottom:20px;border-top:1px solid #f3f4f6;padding-top:16px;">${orbitCards}</td></tr>` : ''}

  <!-- Win + Watch -->
  <tr><td style="padding-bottom:20px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="48%" valign="top" style="background:#f0fdf4;border-radius:10px;padding:12px 14px;">
          <div style="font-size:10px;font-weight:700;color:#15803d;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:5px;">WIN</div>
          <div style="font-size:13px;color:#166534;line-height:1.55;">${insights.winLine}</div>
        </td>
        <td width="4%"></td>
        <td width="48%" valign="top" style="background:#fff7ed;border-radius:10px;padding:12px 14px;">
          <div style="font-size:10px;font-weight:700;color:#c2410c;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:5px;">WATCH</div>
          <div style="font-size:13px;color:#9a3412;line-height:1.55;">${insights.watchLine}</div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Focus this week -->
  <tr><td style="padding-bottom:24px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="4" style="background:#6c63ff;border-radius:2px;"></td>
        <td style="padding:12px 14px;background:#f5f3ff;border-radius:0 10px 10px 0;">
          <div style="font-size:10px;font-weight:700;color:#6c63ff;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:4px;">FOCUS THIS WEEK</div>
          <div style="font-size:13px;color:#3730a3;line-height:1.55;">${insights.focusAction}</div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- CTA -->
  <tr><td style="padding-bottom:28px;">
    <a href="${appUrl}/dashboard"
       style="display:inline-block;background:#6c63ff;color:#ffffff;padding:12px 24px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:600;">
      Check in today →
    </a>
  </td></tr>

  <!-- New features -->
  <tr><td style="padding-bottom:28px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #e5e7eb;border-radius:12px;padding:16px 18px;">
      <tr><td style="padding-bottom:12px;">
        <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#6c63ff;">What's new in Orbit</span>
      </td></tr>
      <tr><td style="padding-bottom:10px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="28" valign="top" style="font-size:16px;padding-top:1px;">🔑</td>
            <td valign="top">
              <div style="font-size:13px;font-weight:700;color:#1a1a2e;margin-bottom:2px;">Sign in with Google</div>
              <div style="font-size:12px;color:#6b7280;line-height:1.5;">Can't remember your password on a new device? Just hit "Continue with Google" — one click, you're in.</div>
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding-bottom:10px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="28" valign="top" style="font-size:16px;padding-top:1px;">📊</td>
            <td valign="top">
              <div style="font-size:13px;font-weight:700;color:#1a1a2e;margin-bottom:2px;">Overall Stats</div>
              <div style="font-size:12px;color:#6b7280;line-height:1.5;">See streaks, completion trends and charts across all your orbits in one place.</div>
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding-bottom:10px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="28" valign="top" style="font-size:16px;padding-top:1px;">🤖</td>
            <td valign="top">
              <div style="font-size:13px;font-weight:700;color:#1a1a2e;margin-bottom:2px;">Orbit AI Assistant</div>
              <div style="font-size:12px;color:#6b7280;line-height:1.5;">Ask anything about your progress, get habit advice, or have AI build a brand new orbit for you from scratch.</div>
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="28" valign="top" style="font-size:16px;padding-top:1px;">🗓️</td>
            <td valign="top">
              <div style="font-size:13px;font-weight:700;color:#1a1a2e;margin-bottom:2px;">Plan My Day</div>
              <div style="font-size:12px;color:#6b7280;line-height:1.5;">Too many tasks across orbits? Plan My Day picks your top priorities for today so you start focused, not overwhelmed.</div>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </td></tr>

  <!-- Sign off -->
  <tr><td style="border-top:1px solid #f3f4f6;padding-top:16px;">
    <p style="font-size:13px;color:#6b7280;font-style:italic;margin:0 0 8px 0;">${insights.closingLine}</p>
    <p style="font-size:11px;color:#d1d5db;margin:0;">— Karthiek from Orbit</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!
    const appUrl = Deno.env.get('APP_URL') || 'https://www.orbityours.com'

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // ?email=xxx → send to that user only
    // No param → hardcoded to marella.karthik@gmail.com until explicitly opened up
    const ALLOW_BULK = false  // flip to true when ready to send to all users
    const url = new URL(req.url)
    const targetEmail = url.searchParams.get('email') || (ALLOW_BULK ? null : 'marella.karthik@gmail.com')

    // Get users from auth
    const listResult = await supabase.auth.admin.listUsers({ perPage: 1000 })
    if (listResult.error) throw listResult.error
    const users = listResult.data?.users || []

    const targets = targetEmail
      ? users.filter(u => u.email?.toLowerCase() === targetEmail.toLowerCase())
      : users.filter(u => u.email)

    if (!targets.length) {
      return new Response(
        JSON.stringify({ message: targetEmail ? `No user found: ${targetEmail}` : 'No users' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const today = new Date().toISOString().split('T')[0]
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const weekStart = sevenDaysAgo.toISOString().split('T')[0]

    const results: any[] = []
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

    for (const user of targets) {
      const email = user.email!
      const userName = user.user_metadata?.full_name?.split(' ')[0]
        || user.user_metadata?.name?.split(' ')[0]
        || email.split('@')[0]

      // Fetch active orbits
      const { data: orbits } = await supabase
        .from('usecases')
        .select('id, name, icon, created_at')
        .eq('user_id', user.id)
        .is('closed_at', null)

      if (!orbits?.length) {
        results.push({ email, status: 'skipped', reason: 'no orbits yet' })
        continue
      }

      const orbitIds = orbits.map(o => o.id)

      const { data: items } = await supabase
        .from('checklist_items')
        .select('id, usecase_id, label, value_type')
        .in('usecase_id', orbitIds)

      const itemIds = (items || []).map(i => i.id)

      const { data: entries } = itemIds.length
        ? await supabase
            .from('checkin_entries')
            .select('checklist_item_id, date, value')
            .in('checklist_item_id', itemIds)
            .gte('date', weekStart)
        : { data: [] }

      const isNewUser = orbits.some(o => new Date(o.created_at) > sevenDaysAgo)
      const totalDaysActive = new Set((entries || []).map((e: any) => e.date)).size

      const orbitStats = orbits.map(orbit =>
        computeOrbitStats(orbit, items || [], entries || [], weekStart)
      )

      // Claude call
      await sleep(300)
      const insights = await getInsights(userName, orbitStats, totalDaysActive, isNewUser, anthropicKey)

      const emailHtml = buildEmail(insights, orbitStats, totalDaysActive, appUrl)

      // Ensure subject is always sentence-cased
      const subject = insights.subject
        ? insights.subject.charAt(0).toUpperCase() + insights.subject.slice(1)
        : 'Your week with Orbit'

      await sleep(500)

      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Karthiek from Orbit <hello@orbityours.com>',
          to: email,
          subject,
          html: emailHtml,
        }),
      })

      const result = await resp.json()
      if (resp.ok) {
        console.log(`✓ ${email} — "${insights.subject}"`)
        results.push({ email, status: 'sent', subject, daysActive: totalDaysActive })
      } else {
        console.error(`✗ ${email}`, result)
        results.push({ email, status: 'failed', error: result.message })
      }

      // Rate limiting: only throttle on bulk sends
      if (!targetEmail && targets.indexOf(user) < targets.length - 1) await sleep(4000)
    }

    const sent = results.filter(r => r.status === 'sent').length
    const skipped = results.filter(r => r.status === 'skipped').length
    const failed = results.filter(r => r.status === 'failed').length

    return new Response(
      JSON.stringify({ success: true, sent, skipped, failed, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error(err)
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
