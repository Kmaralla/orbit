// Orbit Edge Function: Send Push Notifications at 8pm LOCAL TIME
// Schedule: Run every hour (0 * * * *) - checks which timezones have 8pm
// Enhanced with streak-at-risk notifications

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Get current hour in a specific timezone
function getHourInTimezone(timezone: string): number {
  try {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false
    })
    return parseInt(formatter.format(now), 10)
  } catch {
    return -1 // Invalid timezone
  }
}

// Calculate streak for a checklist item (simplified server-side version)
function calculateStreak(entries: { date: string; value: string }[]): { current: number; atRisk: boolean } {
  if (!entries || entries.length === 0) {
    return { current: 0, atRisk: false }
  }

  // Filter to truthy values and sort descending
  const sortedEntries = entries
    .filter(e => e.value && e.value !== '' && e.value !== 'false')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  if (sortedEntries.length === 0) {
    return { current: 0, atRisk: false }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]

  // Create set of completed dates
  const completedDates = new Set(sortedEntries.map(e => e.date))

  // Calculate current streak (working backwards from yesterday since it's 8pm)
  let currentStreak = 0
  const checkDate = new Date(today)

  // Check if completed today
  const checkedToday = completedDates.has(todayStr)

  // Count consecutive days
  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toISOString().split('T')[0]
    if (completedDates.has(dateStr)) {
      currentStreak++
    } else if (dateStr !== todayStr) {
      // Break if we miss a day (but today is OK to skip)
      break
    }
    checkDate.setDate(checkDate.getDate() - 1)
  }

  // At risk if: has a streak, not checked today
  const atRisk = currentStreak > 0 && !checkedToday

  return { current: currentStreak, atRisk }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: 'VAPID keys not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    webpush.setVapidDetails(
      'mailto:support@orbityours.com',
      vapidPublicKey,
      vapidPrivateKey
    )

    // Check if this is a test/manual invocation (send to all) or scheduled (8pm only)
    // Can use ?test=true in URL or { "test": true } in body
    const url = new URL(req.url)
    let forceAll = url.searchParams.get('test') === 'true'

    // Also check request body for test flag (easier from Supabase dashboard)
    try {
      const body = await req.json()
      if (body?.test === true) forceAll = true
    } catch {
      // No body or invalid JSON, that's fine
    }

    // Log invocation start
    await supabase.from('function_logs').insert({
      function_name: 'send-push-notifications',
      status: 'started',
      details: { testMode: forceAll, timestamp: new Date().toISOString() }
    })

    // Get all subscriptions
    const { data: allSubscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('*')

    if (fetchError) {
      return new Response(
        JSON.stringify({ error: 'Database error', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!allSubscriptions || allSubscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No subscriptions found', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch notify_time per user from usecases (use first orbit's setting per user)
    const allUserIds = [...new Set(allSubscriptions.map(s => s.user_id))]
    const { data: notifyConfigs } = await supabase
      .from('usecases')
      .select('user_id, notify_time, timezone')
      .in('user_id', allUserIds)
      .not('notify_time', 'is', null)

    // Build map: user_id → { notifyHour, timezone }
    const userNotifyConfig: Record<string, { notifyHour: number; timezone: string }> = {}
    for (const config of notifyConfigs || []) {
      if (!userNotifyConfig[config.user_id]) {
        const hour = parseInt((config.notify_time || '20:00').split(':')[0], 10)
        userNotifyConfig[config.user_id] = {
          notifyHour: isNaN(hour) ? 20 : hour,
          timezone: config.timezone || 'UTC'
        }
      }
    }

    // Determine per-user: are they at their regular notify time? at the 9pm streak window?
    const userRegularWindow: Record<string, boolean> = {}
    const userStreakWindow: Record<string, boolean> = {}

    for (const sub of allSubscriptions) {
      const config = userNotifyConfig[sub.user_id]
      const tz = config?.timezone || sub.timezone || 'UTC'
      const notifyHour = config?.notifyHour ?? 20
      const currentHour = getHourInTimezone(tz)
      if (currentHour === notifyHour) userRegularWindow[sub.user_id] = true
      if (currentHour === 21) userStreakWindow[sub.user_id] = true  // 9pm streak protection window
    }

    // Candidate subscriptions: at regular time OR at 9pm
    const candidateSubs = forceAll
      ? allSubscriptions
      : allSubscriptions.filter(sub => userRegularWindow[sub.user_id] || userStreakWindow[sub.user_id])

    console.log(`Total subscriptions: ${allSubscriptions.length}, candidates: ${candidateSubs.length}`)

    if (candidateSubs.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No users at their notification window right now', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Group candidate subscriptions by user_id
    const userSubscriptions: Record<string, typeof candidateSubs> = {}
    for (const sub of candidateSubs) {
      if (!userSubscriptions[sub.user_id]) userSubscriptions[sub.user_id] = []
      userSubscriptions[sub.user_id].push(sub)
    }

    const userIds = Object.keys(userSubscriptions)
    console.log(`Unique users to notify: ${userIds.length}`)

    // Fetch streak data for all users
    const today = new Date().toISOString().split('T')[0]
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Get orbits and items for users
    const { data: userOrbits } = await supabase
      .from('usecases')
      .select('id, user_id, name, icon')
      .in('user_id', userIds)

    const orbitIds = userOrbits?.map(o => o.id) || []
    const { data: checklistItems } = await supabase
      .from('checklist_items')
      .select('id, usecase_id, label')
      .in('usecase_id', orbitIds)

    const itemIds = checklistItems?.map(i => i.id) || []
    const { data: recentEntries } = await supabase
      .from('checkin_entries')
      .select('checklist_item_id, date, value')
      .in('checklist_item_id', itemIds)
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0])

    // Build user streak data
    const userStreakInfo: Record<string, { streaksAtRisk: number; bestStreakCount: number; topAtRiskItem?: string; topAtRiskCount: number }> = {}

    for (const userId of userIds) {
      const orbits = userOrbits?.filter(o => o.user_id === userId) || []
      let streaksAtRisk = 0
      let bestStreakCount = 0
      let topAtRiskItem: string | undefined
      let topAtRiskCount = 0

      for (const orbit of orbits) {
        const items = checklistItems?.filter(i => i.usecase_id === orbit.id) || []
        for (const item of items) {
          const entries = recentEntries
            ?.filter(e => e.checklist_item_id === item.id)
            .map(e => ({ date: e.date, value: e.value })) || []

          const streak = calculateStreak(entries)
          if (streak.current > bestStreakCount) bestStreakCount = streak.current
          if (streak.atRisk) {
            streaksAtRisk++
            if (streak.current >= 3 && streak.current > topAtRiskCount) {
              topAtRiskItem = `${orbit.icon} ${item.label}`
              topAtRiskCount = streak.current
            }
          }
        }
      }

      userStreakInfo[userId] = { streaksAtRisk, bestStreakCount, topAtRiskItem, topAtRiskCount }
    }

    const results: { userId: string; device: string; timezone: string; success: boolean; streaksAtRisk: number; error?: string }[] = []

    for (const userId of userIds) {
      const subs = userSubscriptions[userId]
      const streakInfo = userStreakInfo[userId]

      // Determine message type: streak protection (9pm) takes priority over regular
      const isStreakAlert = userStreakWindow[userId] && streakInfo.streaksAtRisk > 0 && streakInfo.topAtRiskCount >= 3

      // If user is ONLY in streak window but has no qualifying streak, skip them
      if (!userRegularWindow[userId] && !isStreakAlert && !forceAll) {
        console.log(`Skipping ${userId} — at 9pm but no meaningful streak at risk`)
        continue
      }

      let title: string
      let body: string

      if (isStreakAlert) {
        // Urgent streak protection message
        title = `⚡ ${streakInfo.topAtRiskCount}-day streak ends tonight`
        body = streakInfo.topAtRiskItem
          ? `Check in before midnight — ${streakInfo.topAtRiskItem} is at risk`
          : `You have ${streakInfo.streaksAtRisk} streak${streakInfo.streaksAtRisk > 1 ? 's' : ''} ending tonight`
      } else if (streakInfo.streaksAtRisk > 0) {
        // Regular time with streaks at risk
        title = '⚠️ Streak at risk — check in!'
        body = streakInfo.topAtRiskItem
          ? `Don't lose: ${streakInfo.topAtRiskItem} (${streakInfo.topAtRiskCount} days)`
          : `${streakInfo.streaksAtRisk} streak${streakInfo.streaksAtRisk > 1 ? 's' : ''} need your attention today`
      } else {
        // Regular daily reminder
        title = '🌟 Time to check in!'
        body = 'Your orbits are waiting for today\'s check-in'
      }

      const payload = JSON.stringify({
        title,
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'orbit-checkin',
        data: { url: '/quick-checkin' }
      })

      // Send to all user's devices
      for (const sub of subs) {
        try {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          }

          await webpush.sendNotification(pushSubscription, payload)
          console.log(`✓ Push sent to ${sub.device_name} (${sub.timezone}) - ${streakInfo.streaksAtRisk} at risk`)
          results.push({
            userId: sub.user_id,
            device: sub.device_name,
            timezone: sub.timezone || 'UTC',
            streaksAtRisk: streakInfo.streaksAtRisk,
            success: true
          })

        } catch (err: any) {
          console.error(`✗ Failed for ${sub.device_name}:`, err.message)
          results.push({
            userId: sub.user_id,
            device: sub.device_name,
            timezone: sub.timezone || 'UTC',
            streaksAtRisk: streakInfo.streaksAtRisk,
            success: false,
            error: err.message
          })

          // Remove invalid subscription
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id)
          }
        }
      }
    }

    const sent = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    // Log success
    await supabase.from('function_logs').insert({
      function_name: 'send-push-notifications',
      status: 'success',
      details: {
        testMode: forceAll,
        totalSubscriptions: allSubscriptions.length,
        matchingNotifyTime: candidateSubs.length,
        sent,
        failed
      }
    })

    return new Response(
      JSON.stringify({
        message: forceAll ? 'Test: sent to all users' : 'Sent to users at their configured notify time',
        totalSubscriptions: allSubscriptions.length,
        sent,
        failed,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('Function error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
