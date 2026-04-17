// Supabase Edge Function: Send smart daily reminder emails
// Deploy: supabase functions deploy send-reminders
// Schedule: every hour (0 * * * *)
// Test: invoke with { "test": true }

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
  timezone: string
  user_id: string
  snoozed_until: string | null
}

interface ChecklistItem {
  id: string
  usecase_id: string
  label: string
  value_type: string
  frequency: string | null
}

function getHourInTimezone(timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, hour: 'numeric', hour12: false,
    })
    return parseInt(formatter.format(new Date()), 10)
  } catch { return -1 }
}

function getLocalDate(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())
    return parts // returns YYYY-MM-DD
  } catch {
    return new Date().toISOString().split('T')[0]
  }
}

function getDayOfWeek(timezone: string): string {
  try {
    const day = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, weekday: 'short',
    }).format(new Date()).toLowerCase()
    return day.slice(0, 3)
  } catch { return 'mon' }
}

function isScheduledToday(frequency: string | null, dayOfWeek: string): boolean {
  if (!frequency || frequency === 'daily') return true
  if (frequency === 'weekdays') return ['mon', 'tue', 'wed', 'thu', 'fri'].includes(dayOfWeek)
  if (frequency === 'weekly') return dayOfWeek === 'mon'
  if (frequency.startsWith('custom:')) {
    const days = frequency.split(':')[1]?.split(',') || []
    return days.includes(dayOfWeek)
  }
  return true
}

// Dynamic subject line based on streak / day / time
function buildSubject(
  orbits: Usecase[],
  checkedInYesterday: boolean,
  bestStreak: number,
  pendingCount: number,
  hour: number,
  dayOfWeek: string,
): string {
  const orbitName = orbits[0]?.name || 'your orbit'
  const icon = orbits[0]?.icon || '○'

  // At-risk: didn't check in yesterday and had a streak
  if (!checkedInYesterday && bestStreak >= 3) {
    return `${icon} Don't break your ${bestStreak}-day streak 🔥`
  }

  // Long streak — celebrate it
  if (bestStreak >= 30) {
    return `${icon} Day ${bestStreak} — legendary. Don't stop now 🏆`
  }
  if (bestStreak >= 14) {
    return `${icon} ${bestStreak} days straight. That's real momentum 💪`
  }
  if (bestStreak >= 7) {
    return `Week-long streak going 🔥 — ${orbitName} is waiting`
  }

  // Monday energy
  if (dayOfWeek === 'mon') {
    return `New week, same mission — ${orbits.length > 1 ? `${orbits.length} orbits` : orbitName} to check in ✦`
  }
  // Friday close-out
  if (dayOfWeek === 'fri') {
    return `Finish the week strong 💪 — ${pendingCount} thing${pendingCount !== 1 ? 's' : ''} left today`
  }

  // Evening nudge
  if (hour >= 18) {
    return `Before the day ends — ${pendingCount} item${pendingCount !== 1 ? 's' : ''} still pending`
  }

  // Generic but human
  const variants = [
    `Hey — ${pendingCount} quick thing${pendingCount !== 1 ? 's' : ''} before the day slips by`,
    `${icon} Your ${orbitName} check-in is waiting (takes 30 sec)`,
    `5 minutes. That's all today needs. ✦`,
    `Small actions, big life. Time to check in ${icon}`,
  ]
  return variants[Math.floor(Math.random() * variants.length)]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!
    const appUrl = Deno.env.get('APP_URL') || 'https://www.orbityours.com'
    const snoozeBaseUrl = 'https://aeuvwynwyrlrtgkrujts.functions.supabase.co/snooze-reminder'

    if (!supabaseUrl || !supabaseServiceKey || !resendApiKey) {
      throw new Error('Missing environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let forceAll = false
    let testEmail: string | null = null
    try {
      const body = await req.json()
      if (body?.test === true) forceAll = true
      if (body?.testEmail) testEmail = body.testEmail
    } catch { /* no body */ }

    await supabase.from('function_logs').insert({
      function_name: 'send-reminders',
      status: 'started',
      details: { testMode: forceAll, timestamp: new Date().toISOString() }
    })

    // Fetch all orbits with reminders configured
    const { data: allUsecases, error: fetchError } = await supabase
      .from('usecases')
      .select('id, name, icon, notify_email, notify_time, timezone, user_id, snoozed_until')
      .not('notify_email', 'is', null)
      .is('closed_at', null)

    if (fetchError) throw fetchError

    // Filter to orbits due now (or force all / testEmail), and not snoozed
    const now = new Date()
    const usecases = (allUsecases as Usecase[])?.filter(uc => {
      // testEmail mode: only include orbits for that specific email, ignore time/snooze
      if (testEmail) return uc.notify_email === testEmail

      // Skip snoozed
      if (uc.snoozed_until && new Date(uc.snoozed_until) > now) return false

      if (forceAll) return true
      if (!uc.notify_time) return false

      const userTz = uc.timezone || 'Asia/Kolkata'
      const currentHour = getHourInTimezone(userTz)
      const reminderHour = parseInt(uc.notify_time.split(':')[0], 10)
      return reminderHour === currentHour
    }) || []

    if (usecases.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No reminders due now', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Group by email → user
    const byEmail: Record<string, { userId: string; timezone: string; orbits: Usecase[] }> = {}
    for (const uc of usecases) {
      if (!byEmail[uc.notify_email]) {
        byEmail[uc.notify_email] = { userId: uc.user_id, timezone: uc.timezone || 'Asia/Kolkata', orbits: [] }
      }
      byEmail[uc.notify_email].orbits.push(uc)
    }

    // Fetch all checklist items for relevant orbit ids
    const allOrbitIds = usecases.map(uc => uc.id)
    const { data: allItems } = await supabase
      .from('checklist_items')
      .select('id, usecase_id, label, value_type, frequency')
      .in('usecase_id', allOrbitIds)

    // Fetch today's entries for all relevant users
    const userIds = [...new Set(usecases.map(uc => uc.user_id))]

    // We need to get entries per user — fetch for each timezone's local date
    // (simple approach: fetch last 2 days and filter client-side)
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

    const { data: recentEntries } = await supabase
      .from('checkin_entries')
      .select('checklist_item_id, user_id, date, value')
      .in('user_id', userIds)
      .gte('date', twoDaysAgo.toISOString().split('T')[0])

    // Fetch yesterday's daily_plans for all users (to show plan completion in email)
    const { data: yesterdayPlans } = await supabase
      .from('daily_plans')
      .select('user_id, date, flat_items, summary')
      .in('user_id', userIds)
      .gte('date', twoDaysAgo.toISOString().split('T')[0])

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
    const results: { email: string; status: string; subject?: string; error?: string }[] = []

    for (let i = 0; i < Object.keys(byEmail).length; i++) {
      const email = Object.keys(byEmail)[i]
      if (i > 0) await sleep(8000)

      const { userId, timezone, orbits } = byEmail[email]
      const userTz = timezone || 'Asia/Kolkata'
      const localDate = getLocalDate(userTz)
      const yesterday = new Date(localDate)
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]
      const hour = getHourInTimezone(userTz)
      const dayOfWeek = getDayOfWeek(userTz)

      // Entries for this user
      const userEntries = (recentEntries || []).filter(e => e.user_id === userId)

      // Yesterday's plan completion
      const yPlan = (yesterdayPlans || []).find(p => p.user_id === userId && p.date === yesterdayStr)
      let yesterdayPlanHtml = ''
      if (yPlan) {
        const flatItems = (yPlan.flat_items || []).filter((fi: { isSideQuest?: boolean }) => !fi.isSideQuest)
        const totalCount = flatItems.length
        if (totalCount > 0) {
          const yesterdayDoneIds = new Set(
            userEntries
              .filter(e => e.date === yesterdayStr && e.value && e.value !== '' && e.value !== 'false')
              .map(e => e.checklist_item_id)
          )
          const doneCount = flatItems.filter((fi: { id: string }) => yesterdayDoneIds.has(fi.id)).length
          const pct = Math.round((doneCount / totalCount) * 100)
          const emoji = pct === 100 ? '🎉' : pct >= 70 ? '💪' : pct >= 40 ? '📈' : '🌱'
          const msg = pct === 100
            ? `You crushed yesterday's plan — all ${totalCount} tasks done!`
            : `Yesterday you completed ${doneCount} of ${totalCount} planned tasks (${pct}%). ${pct >= 70 ? 'Strong finish!' : 'Every bit counts — keep going.'}`
          yesterdayPlanHtml = `
            <div style="background:#6c63ff12;border:1px solid #6c63ff33;border-radius:12px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:flex-start;gap:10px;">
              <span style="font-size:18px;line-height:1.2;">${emoji}</span>
              <div>
                <div style="font-size:12px;font-weight:700;color:#6c63ff;margin-bottom:3px;text-transform:uppercase;letter-spacing:0.4px;">Yesterday's Plan</div>
                <div style="font-size:13px;color:#a8a4c8;line-height:1.5;">${msg} Continue customizing your day with <strong style="color:#e8e4f0;">Plan My Day</strong>.</div>
              </div>
            </div>`
        }
      }
      const todayDoneIds = new Set(
        userEntries
          .filter(e => e.date === localDate && e.value && e.value !== '' && e.value !== 'false')
          .map(e => e.checklist_item_id)
      )
      const checkedInYesterday = userEntries.some(e => e.date === yesterdayStr)

      // Build pending items per orbit
      const orbitSections: { orbit: Usecase; pending: ChecklistItem[]; done: number; total: number }[] = []
      let totalPending = 0
      let bestStreak = 0

      for (const orbit of orbits) {
        const orbitItems = (allItems || []).filter(i =>
          i.usecase_id === orbit.id && isScheduledToday(i.frequency, dayOfWeek)
        ) as ChecklistItem[]

        const pending = orbitItems.filter(i => !todayDoneIds.has(i.id))
        const done = orbitItems.length - pending.length

        // Rough streak estimate: count consecutive days with at least one done entry for this orbit
        const orbitItemIds = new Set(orbitItems.map(i => i.id))
        let streak = 0
        for (let d = 0; d < 14; d++) {
          const checkDate = new Date(localDate)
          checkDate.setDate(checkDate.getDate() - d)
          const dateStr = checkDate.toISOString().split('T')[0]
          const hasDone = userEntries.some(e =>
            orbitItemIds.has(e.checklist_item_id) && e.date === dateStr && e.value && e.value !== '' && e.value !== 'false'
          )
          if (!hasDone) break
          streak++
        }
        if (streak > bestStreak) bestStreak = streak

        if (pending.length > 0) {
          orbitSections.push({ orbit, pending, done, total: orbitItems.length })
          totalPending += pending.length
        }
      }

      // Skip if everything is already done today
      if (totalPending === 0) {
        results.push({ email, status: 'skipped', subject: 'all done' })
        continue
      }

      const subject = buildSubject(orbits, checkedInYesterday, bestStreak, totalPending, hour, dayOfWeek)

      // Streak badge
      const streakBadge = bestStreak >= 3
        ? `<div style="display:inline-block;background:#f59e0b18;border:1px solid #f59e0b44;border-radius:20px;padding:5px 14px;font-size:12px;color:#f59e0b;font-weight:700;margin-bottom:18px;">🔥 ${bestStreak}-day streak</div>`
        : ''

      // At-risk warning
      const atRiskBanner = (!checkedInYesterday && bestStreak >= 3)
        ? `<div style="background:#ef444412;border:1px solid #ef444433;border-radius:12px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:#ef4444;font-weight:600;">⚠️ Your ${bestStreak}-day streak is at risk — check in today to keep it alive</div>`
        : ''

      // Orbit sections with pending items
      const orbitHtml = orbitSections.map(({ orbit, pending, done, total }) => `
        <div style="margin-bottom:12px;background:#13131f;border:1px solid #1e1e3a;border-radius:14px;overflow:hidden;">
          <div style="padding:12px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #1e1e3a;">
            <span style="font-size:22px;">${orbit.icon || '🎯'}</span>
            <div style="flex:1;">
              <div style="font-size:14px;font-weight:700;color:#e8e4f0;">${orbit.name}</div>
              <div style="font-size:11px;color:#4a4870;margin-top:2px;">${done}/${total} done today</div>
            </div>
            ${done > 0
              ? `<div style="width:40px;height:5px;background:#1e1e3a;border-radius:3px;overflow:hidden;">
                   <div style="width:${Math.round((done/total)*100)}%;height:100%;background:#22c55e;border-radius:3px;"></div>
                 </div>`
              : ''}
          </div>
          <div style="padding:8px 0;">
            ${pending.slice(0, 4).map(item => `
              <div style="display:flex;align-items:center;gap:10px;padding:8px 16px;">
                <div style="width:16px;height:16px;border-radius:50%;border:2px solid #2a2a44;flex-shrink:0;"></div>
                <span style="font-size:13px;color:#a8a4c8;">${item.label}</span>
              </div>
            `).join('')}
            ${pending.length > 4
              ? `<div style="font-size:11px;color:#4a4870;padding:4px 16px 8px;">+${pending.length - 4} more…</div>`
              : ''}
          </div>
        </div>
      `).join('')

      // Snooze links (only works once SQL column exists)
      // & must be &amp; inside HTML href attributes — unescaped & corrupts the URL in many email clients
      const snooze2h = `${snoozeBaseUrl}?uid=${userId}&amp;hours=2`
      const snooze4h = `${snoozeBaseUrl}?uid=${userId}&amp;hours=4`

      const emailHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#080810;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#080810;padding:28px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;">

  <!-- Logo -->
  <tr><td style="padding-bottom:20px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td><span style="font-size:16px;font-weight:700;color:#e8e4f0;"><span style="color:#6c63ff;">●</span> Orbit</span></td>
        <td style="text-align:right;"><span style="font-size:11px;color:#3a3858;text-transform:uppercase;letter-spacing:0.5px;">Daily Check-in</span></td>
      </tr>
    </table>
  </td></tr>

  <!-- Yesterday's plan completion -->
  ${yesterdayPlanHtml ? `<tr><td>${yesterdayPlanHtml}</td></tr>` : ''}

  <!-- Streak badge + at-risk banner -->
  <tr><td>
    ${streakBadge}
    ${atRiskBanner}
  </td></tr>

  <!-- Headline -->
  <tr><td style="padding-bottom:20px;">
    <p style="font-size:20px;font-weight:800;color:#e8e4f0;margin:0 0 6px 0;line-height:1.3;">
      ${totalPending} thing${totalPending !== 1 ? 's' : ''} waiting for you today
    </p>
    <p style="font-size:13px;color:#4a4870;margin:0;line-height:1.5;">
      Takes about ${totalPending <= 3 ? '30 seconds' : totalPending <= 6 ? 'a minute' : '2–3 minutes'} to tick off.
    </p>
  </td></tr>

  <!-- Orbit sections -->
  <tr><td style="padding-bottom:20px;">
    ${orbitHtml}
  </td></tr>

  <!-- Primary CTA -->
  <tr><td style="padding-bottom:24px;text-align:center;">
    <a href="${appUrl}/quick-checkin"
       style="display:inline-block;background:#6c63ff;color:#fff;padding:15px 36px;border-radius:12px;text-decoration:none;font-size:15px;font-weight:700;letter-spacing:0.1px;">
      Check in now ✦
    </a>
  </td></tr>

  <!-- Snooze -->
  <tr><td style="padding-bottom:28px;text-align:center;">
    <span style="font-size:12px;color:#3a3858;">Not now? </span>
    <a href="${snooze2h}" style="font-size:12px;color:#6c63ff;text-decoration:none;">Remind me in 2h</a>
    <span style="font-size:12px;color:#3a3858;"> · </span>
    <a href="${snooze4h}" style="font-size:12px;color:#6c63ff;text-decoration:none;">4h</a>
  </td></tr>

  <!-- Footer -->
  <tr><td style="border-top:1px solid #12122a;padding-top:20px;text-align:center;">
    <p style="font-size:11px;color:#3a3858;margin:0;line-height:1.7;">
      You're getting this because you enabled reminders in Orbit.<br>
      <a href="${appUrl}/dashboard" style="color:#4a4870;text-decoration:none;">Edit notification settings →</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`

      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Orbit <reminders@orbityours.com>',
            to: testEmail || email,
            subject: testEmail ? `[TEST] ${subject}` : subject,
            html: emailHtml,
          }),
        })

        const responseData = await response.json()
        if (!response.ok) {
          results.push({ email, status: 'failed', subject, error: responseData.message })
        } else {
          results.push({ email, status: 'sent', subject })
        }
      } catch (err) {
        results.push({ email, status: 'error', error: String(err) })
      }
    }

    const sent = results.filter(r => r.status === 'sent').length
    const skipped = results.filter(r => r.status === 'skipped').length
    const failed = results.filter(r => r.status !== 'sent' && r.status !== 'skipped').length

    await supabase.from('function_logs').insert({
      function_name: 'send-reminders',
      status: 'success',
      details: { testMode: forceAll, sent, skipped, failed }
    })

    return new Response(
      JSON.stringify({ success: true, sent, skipped, failed, results }),
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
