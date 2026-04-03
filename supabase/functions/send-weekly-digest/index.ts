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

      // Subject based on performance
      let subject: string
      if (avgRate >= 80) subject = `🔥 Strong week — here's what you built`
      else if (avgRate >= 50) subject = `📈 Solid progress this week — your Orbit recap`
      else if (totalDays >= 3) subject = `You showed up ${totalDays} days this week — here's the recap`
      else subject = `Your weekly Orbit recap — let's make next week count`

      if (testEmail) subject = `[TEST] ${subject}`

      // Rate color
      const rateColor = avgRate >= 70 ? '#22c55e' : avgRate >= 40 ? '#f59e0b' : '#ef4444'

      const orbitRowsHtml = orbitStats.map(({ orbit, daysActive, rate, topItem }) => {
        const rowColor = rate >= 70 ? '#22c55e' : rate >= 40 ? '#f59e0b' : '#ef4444'
        const barWidth = rate
        return `
          <div style="margin-bottom:12px;background:#13131f;border:1px solid #1e1e3a;border-radius:14px;padding:14px 16px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
              <span style="font-size:22px;">${orbit.icon || '🎯'}</span>
              <div style="flex:1;">
                <div style="font-size:14px;font-weight:700;color:#e8e4f0;">${orbit.name}</div>
                ${topItem ? `<div style="font-size:11px;color:#6b6b8a;margin-top:2px;">Best: ${topItem.label}</div>` : ''}
              </div>
              <div style="text-align:right;flex-shrink:0;">
                <div style="font-size:16px;font-weight:800;color:${rowColor};font-family:-apple-system,sans-serif;">${daysActive}/7</div>
                <div style="font-size:10px;color:#4a4870;">days</div>
              </div>
            </div>
            <div style="height:5px;background:#1e1e3a;border-radius:3px;overflow:hidden;">
              <div style="width:${barWidth}%;height:100%;background:${rowColor};border-radius:3px;"></div>
            </div>
          </div>
        `
      }).join('')

      // Motivational line based on rate
      let motLine: string
      if (avgRate >= 80) motLine = "That's a week you can be proud of. The compound effect of this is real."
      else if (avgRate >= 60) motLine = "More than half the week showing up. That's how habits get built — not perfection, consistency."
      else if (avgRate >= 30) motLine = "Some days you show up, some days life happens. What matters is you're still tracking."
      else motLine = "Life gets busy. This week, just aim to check in one more day than last week."

      const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#080810;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#080810;padding:28px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;">

  <!-- Logo -->
  <tr><td style="padding-bottom:24px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><span style="font-size:16px;font-weight:700;color:#e8e4f0;"><span style="color:#6c63ff;">●</span> Orbit</span></td>
      <td style="text-align:right;"><span style="font-size:11px;color:#3a3858;text-transform:uppercase;letter-spacing:0.5px;">Weekly Recap</span></td>
    </tr></table>
  </td></tr>

  <!-- Headline -->
  <tr><td style="padding-bottom:8px;">
    <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6c63ff;margin:0 0 10px 0;">This week at a glance</p>
    <p style="font-size:22px;font-weight:800;color:#e8e4f0;margin:0 0 6px 0;line-height:1.2;">
      ${avgRate}% completion across ${orbits.length} orbit${orbits.length !== 1 ? 's' : ''}
    </p>
    <p style="font-size:14px;color:#6b6b8a;margin:0 0 20px 0;">${motLine}</p>
  </td></tr>

  <!-- Overall rate bar -->
  <tr><td style="padding-bottom:24px;">
    <div style="background:#13131f;border:1px solid #1e1e3a;border-radius:14px;padding:16px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:12px;color:#6b6b8a;">Overall this week</span>
        <span style="font-size:14px;font-weight:800;color:${rateColor};">${avgRate}%</span>
      </div>
      <div style="height:8px;background:#1e1e3a;border-radius:4px;overflow:hidden;">
        <div style="width:${avgRate}%;height:100%;background:${rateColor};border-radius:4px;"></div>
      </div>
    </div>
  </td></tr>

  <!-- Per-orbit rows -->
  <tr><td style="padding-bottom:24px;">
    ${orbitRowsHtml}
  </td></tr>

  <!-- CTA -->
  <tr><td style="padding-bottom:28px;text-align:center;">
    <a href="${appUrl}/dashboard"
       style="display:inline-block;background:#6c63ff;color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-size:14px;font-weight:700;">
      Open Orbit →
    </a>
  </td></tr>

  <!-- Footer -->
  <tr><td style="border-top:1px solid #12122a;padding-top:20px;text-align:center;">
    <p style="font-size:11px;color:#3a3858;margin:0;line-height:1.8;">
      Your weekly recap from Orbit · every Sunday<br>
      <a href="${appUrl}/dashboard" style="color:#4a4870;text-decoration:none;">Manage notification settings →</a>
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
          body: JSON.stringify({ from: 'Orbit <reminders@orbityours.com>', to: testEmail || email, subject, html: emailHtml }),
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
