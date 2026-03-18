// Orbit Edge Function: Send Push Notifications at 8pm LOCAL TIME
// Schedule: Run every hour (0 * * * *) - checks which timezones have 8pm

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

    // Filter subscriptions where local time is 8pm (20:00), unless test mode
    const subscriptionsToNotify = forceAll
      ? allSubscriptions
      : allSubscriptions.filter(sub => {
          const tz = sub.timezone || 'UTC'
          const hour = getHourInTimezone(tz)
          console.log(`User ${sub.user_id} timezone: ${tz}, current hour: ${hour}`)
          return hour === 20 // 8pm
        })

    console.log(`Total subscriptions: ${allSubscriptions.length}`)
    console.log(`Subscriptions at 8pm local time: ${subscriptionsToNotify.length}`)

    if (subscriptionsToNotify.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'No users at 8pm local time right now',
          totalSubscriptions: allSubscriptions.length,
          sent: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results: { userId: string; device: string; timezone: string; success: boolean; error?: string }[] = []

    for (const sub of subscriptionsToNotify) {
      try {
        const payload = JSON.stringify({
          title: '🌟 Time to check in!',
          body: 'Your orbits are waiting for today\'s check-in',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: 'orbit-checkin',
          data: { url: '/quick-checkin' }
        })

        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        }

        await webpush.sendNotification(pushSubscription, payload)
        console.log(`✓ Push sent to ${sub.device_name} (${sub.timezone})`)
        results.push({
          userId: sub.user_id,
          device: sub.device_name,
          timezone: sub.timezone || 'UTC',
          success: true
        })

      } catch (err: any) {
        console.error(`✗ Failed for ${sub.device_name}:`, err.message)
        results.push({
          userId: sub.user_id,
          device: sub.device_name,
          timezone: sub.timezone || 'UTC',
          success: false,
          error: err.message
        })

        // Remove invalid subscription
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    }

    const sent = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    return new Response(
      JSON.stringify({
        message: forceAll ? 'Test: sent to all users' : 'Sent to users at 8pm local time',
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
