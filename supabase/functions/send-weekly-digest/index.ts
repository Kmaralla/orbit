// Weekly digest email — sends Sunday evenings
// Shows what users actually built that week, not a reminder
// Schedule: 0 17 * * 0  (Sunday 5pm UTC → ~10pm IST)
// Test: invoke with { "testEmail": "you@example.com" }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function getLocalDate(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())
  } catch { return new Date().toISOString().split('T')[0] }
}

function getDayOfWeek(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long' }).format(new Date())
  } catch { return 'Sunday' }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!
    const appUrl = Deno.env.get('APP_URL') || 'https://www.orbityours.com'

    let testEmail: string | null = null
    let forceAll = false
    try {
      const body = await req.json()
      if (body?.testEmail) testEmail = body.testEmail
      if (body?.send === true) forceAll = true
    } catch {}

    // Get all users with notify_email (they opted into comms)
    const { data: usecases } = await supabase
      .from('usecases')
      .select('id, name, icon, notify_email, user_id, timezone, goal_statement')
      .not('notify_email', 'is', null)
      .is('closed_at', null)

    if (!usecases?.length) {
      return new Response(JSON.stringify({ message: 'No users', sent: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Group by email
    const byEmail: Record<string, { userId: string; timezone: string; orbits: typeof usecases }> = {}
    for (const uc of usecases) {
      if (testEmail && uc.notify_email !== testEmail) continue
      if (!byEmail[uc.notify_email]) {
        byEmail[uc.notify_email] = { userId: uc.user_id, timezone: uc.timezone || 'Asia/Kolkata', orbits: [] }
      }
      byEmail[uc.notify_email].orbits.push(uc)
    }

    // Only send on Sundays unless forced or test
    const emails = Object.keys(byEmail)
    if (!testEmail && !forceAll) {
      const firstUserTz = Object.values(byEmail)[0]?.timezone || 'UTC'
      const dayOfWeek = getDayOfWeek(firstUserTz)
      if (dayOfWeek !== 'Sunday') {
        return new Response(JSON.stringify({ message: 'Not Sunday — skipping', day: dayOfWeek }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    if (emails.length === 0) {
      return new Response(JSON.stringify({ message: 'No matching users', sent: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Fetch 7 days of entry data for all relevant users
    const userIds = [...new Set(Object.values(byEmail).map(u => u.userId))]
    const orbitIds = usecases.filter(uc => !testEmail || uc.notify_email === testEmail).map(uc => uc.id)

    const { data: allItems } = await supabase
      .from('checklist_items')
      .select('id, usecase_id, label, value_type')
      .in('usecase_id', orbitIds)

    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const { data: weekEntries } = await supabase
      .from('checkin_entries')
      .select('checklist_item_id, user_id, date, value')
      .in('user_id', userIds)
      .gte('date', sevenDaysAgo.toISOString().split('T')[0])

    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
    const results: { email: string; status: string; error?: string }[] = []

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i]
      if (i > 0) await sleep(8000)

      const { userId, timezone, orbits } = byEmail[email]
      const localDate = getLocalDate(timezone)

      // Per-orbit stats for this week
      const orbitStats = orbits.map(orbit => {
        const orbitItemIds = (allItems || []).filter(i => i.usecase_id === orbit.id).map(i => i.id)
        const orbitEntries = (weekEntries || []).filter(e => e.user_id === userId && orbitItemIds.includes(e.checklist_item_id))

        // Distinct dates with at least one completion
        const doneDates = new Set(
          orbitEntries.filter(e => e.value && e.value !== '' && e.value !== 'false').map(e => e.date)
        )
        const daysActive = doneDates.size
        const rate = Math.round((daysActive / 7) * 100)

        // Find most-completed item
        const itemCounts: Record<string, number> = {}
        for (const e of orbitEntries.filter(e => e.value && e.value !== '' && e.value !== 'false')) {
          itemCounts[e.checklist_item_id] = (itemCounts[e.checklist_item_id] || 0) + 1
        }
        const topItemId = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
        const topItem = (allItems || []).find(i => i.id === topItemId)

        return { orbit, daysActive, rate, topItem }
      })

      const totalDays = Math.max(...orbitStats.map(o => o.daysActive), 0)
      const avgRate = orbitStats.length > 0
        ? Math.round(orbitStats.reduce((s, o) => s + o.rate, 0) / orbitStats.length)
        : 0

      // Subject — conversational, reads like a personal note not a notification
      let subject: string
      if (avgRate >= 80) subject = `${totalDays} out of 7 days. That's your week.`
      else if (avgRate >= 60) subject = `You showed up ${totalDays} days this week — here's the picture`
      else if (totalDays >= 3) subject = `${totalDays} days of showing up. Your week, reflected.`
      else subject = `A quiet week. Here's what it looked like.`

      if (testEmail) subject = `[TEST] ${subject}`

      // Date string for letter header
      const weekEnd = new Date()
      const weekStart = new Date(); weekStart.setDate(weekEnd.getDate() - 6)
      const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
      const weekRange = `${fmt(weekStart)} – ${fmt(weekEnd)}`

      // Opening paragraph — human, not metric
      let opening: string
      if (avgRate >= 80) {
        opening = `You had a really consistent week. Across ${orbits.length} thing${orbits.length !== 1 ? 's' : ''} you're tracking, you showed up more days than not — and that matters more than any single check-in.`
      } else if (avgRate >= 50) {
        opening = `A solid week. Not perfect — but consistent enough that the habits are taking root. Here's what the data looked like across your orbits.`
      } else if (totalDays >= 2) {
        opening = `Some weeks are harder than others. You still showed up ${totalDays} days, which means the thread isn't broken. Here's a look at where things stood.`
      } else {
        opening = `It was a quiet week for check-ins. That's okay — life has texture. The fact that you're still here, still tracking, still trying — that's the whole game.`
      }

      // Closing thought
      let closing: string
      if (avgRate >= 80) closing = `The compound effect of weeks like this one is something you'll feel months from now. Keep going.`
      else if (avgRate >= 50) closing = `Consistency over perfection, every time. Next week, just aim to match this one.`
      else closing = `One more check-in next week than this week. That's the only goal. You've got this.`

      // Rate color (for bars — subtle on white)
      const rateColor = avgRate >= 70 ? '#16a34a' : avgRate >= 40 ? '#d97706' : '#dc2626'
      const rateBg   = avgRate >= 70 ? '#dcfce7' : avgRate >= 40 ? '#fef3c7' : '#fee2e2'

      // Orbit cards — light, clean, no dark UI
      const orbitRowsHtml = orbitStats.map(({ orbit, daysActive, rate, topItem }) => {
        const barColor = rate >= 70 ? '#16a34a' : rate >= 40 ? '#d97706' : '#dc2626'
        const dotColor = rate >= 70 ? '#22c55e' : rate >= 40 ? '#f59e0b' : '#ef4444'
        // Mini 7-dot calendar
        const dots = Array.from({ length: 7 }, (_, i) => {
          // We don't have day-by-day breakdown easily here, use rate as proxy
          const filled = i < daysActive
          return `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${filled ? dotColor : '#e5e7eb'};margin:0 1px;"></span>`
        }).join('')

        return `
          <tr>
            <td style="padding:0 0 10px 0;">
              <div style="border:1px solid #e8e4f0;border-radius:14px;padding:16px 18px;background:#ffffff;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:36px;vertical-align:top;padding-top:2px;">
                      <span style="font-size:24px;">${orbit.icon || '🎯'}</span>
                    </td>
                    <td style="padding-left:10px;">
                      <div style="font-size:15px;font-weight:700;color:#1a1a2e;margin-bottom:3px;">${orbit.name}</div>
                      ${topItem ? `<div style="font-size:12px;color:#6b7280;">Strongest: <em>${topItem.label}</em></div>` : ''}
                      <div style="margin-top:10px;">${dots}</div>
                    </td>
                    <td style="text-align:right;vertical-align:top;white-space:nowrap;">
                      <span style="font-size:20px;font-weight:900;color:${barColor};font-family:-apple-system,sans-serif;">${daysActive}<span style="font-size:12px;font-weight:500;color:#9ca3af;">/7</span></span>
                      <div style="font-size:10px;color:#9ca3af;margin-top:2px;text-transform:uppercase;letter-spacing:0.5px;">days</div>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>
        `
      }).join('')

      const emailHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f3f2f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Georgia,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f2f8;padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">

  <!-- Header -->
  <tr><td style="padding-bottom:20px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <span style="font-size:15px;font-weight:700;color:#1a1a2e;letter-spacing:-0.2px;">
          <span style="color:#6c63ff;">●</span> Orbit
        </span>
      </td>
      <td style="text-align:right;">
        <span style="font-size:12px;color:#9ca3af;">${weekRange}</span>
      </td>
    </tr></table>
  </td></tr>

  <!-- Letter card -->
  <tr><td>
    <div style="background:#ffffff;border-radius:20px;padding:32px 28px;margin-bottom:12px;border:1px solid #e8e4f0;">

      <!-- Opening -->
      <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#6c63ff;margin:0 0 16px 0;">Your week in Orbit</p>

      <p style="font-size:17px;color:#1a1a2e;margin:0 0 20px 0;line-height:1.7;font-weight:400;">
        ${opening}
      </p>

      <!-- Big stat -->
      <div style="background:#f8f7ff;border-radius:14px;padding:20px 24px;margin-bottom:24px;text-align:center;">
        <div style="font-size:52px;font-weight:900;color:#6c63ff;line-height:1;font-family:-apple-system,sans-serif;">${totalDays}</div>
        <div style="font-size:14px;color:#6b7280;margin-top:6px;">days checked in this week</div>
        <div style="display:inline-block;background:${rateBg};color:${rateColor};font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;margin-top:10px;">${avgRate}% overall</div>
      </div>

      <!-- Orbit rows -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
        ${orbitRowsHtml}
      </table>

      <!-- Closing thought -->
      <p style="font-size:15px;color:#374151;margin:0;line-height:1.7;border-top:1px solid #f0eef8;padding-top:20px;">
        ${closing}
      </p>
    </div>
  </td></tr>

  <!-- Subtle CTA -->
  <tr><td style="padding:16px 0 8px;text-align:center;">
    <a href="${appUrl}/dashboard"
       style="font-size:13px;color:#6c63ff;text-decoration:none;font-weight:600;">
      See your full stats in Orbit →
    </a>
  </td></tr>

  <!-- Sign-off -->
  <tr><td style="padding:8px 0 24px;text-align:center;">
    <p style="font-size:13px;color:#9ca3af;margin:0;line-height:1.7;">
      — Karthiek<br>
      <span style="font-size:11px;">Every Sunday, a look at your week. No spam, ever.</span>
    </p>
  </td></tr>

</table>
</td></tr>
</table>

</body>
</html>`

      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: 'Karthiek from Orbit <hello@orbityours.com>', to: testEmail || email, subject, html: emailHtml }),
        })
        const data = await res.json()
        results.push({ email, status: res.ok ? 'sent' : 'failed', error: res.ok ? undefined : data.message })
      } catch (err) {
        results.push({ email, status: 'error', error: String(err) })
      }
    }

    const sent = results.filter(r => r.status === 'sent').length
    await supabase.from('function_logs').insert({
      function_name: 'send-weekly-digest',
      status: 'success',
      details: { sent, total: emails.length }
    })

    return new Response(JSON.stringify({ success: true, sent, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})
