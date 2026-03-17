// Orbit Edge Function: Send Push Notifications at 8pm IST
// Schedule: 30 14 * * * (8pm IST = 2:30pm UTC)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Web Push library for Deno
import webpush from 'https://esm.sh/web-push@3.6.6'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
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
      console.error('VAPID keys not configured')
      return new Response(
        JSON.stringify({ error: 'VAPID keys not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Configure web-push with VAPID keys
    webpush.setVapidDetails(
      'mailto:support@orbityours.com',
      vapidPublicKey,
      vapidPrivateKey
    )

    // Get all primary push subscriptions (one per user, most used device)
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('*, usecases:user_id(id, name, icon)')
      .eq('is_primary', true)

    if (fetchError) {
      console.error('Error fetching subscriptions:', fetchError)
      throw fetchError
    }

    console.log(`Found ${subscriptions?.length || 0} primary subscriptions`)

    const results: { userId: string; success: boolean; error?: string }[] = []

    // Helper to add delay between sends
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    for (const sub of subscriptions || []) {
      try {
        // Get unchecked orbits for this user today
        const today = new Date().toISOString().split('T')[0]

        const { data: userOrbits } = await supabase
          .from('usecases')
          .select('id, name, icon')
          .eq('user_id', sub.user_id)

        if (!userOrbits || userOrbits.length === 0) {
          console.log(`User ${sub.user_id}: No orbits, skipping`)
          continue
        }

        // Get today's entries
        const { data: todayEntries } = await supabase
          .from('checkin_entries')
          .select('checklist_item_id, checklist_items!inner(usecase_id)')
          .eq('user_id', sub.user_id)
          .eq('date', today)

        const checkedOrbitIds = new Set(
          todayEntries?.map(e => e.checklist_items?.usecase_id).filter(Boolean)
        )

        const uncheckedOrbits = userOrbits.filter(o => !checkedOrbitIds.has(o.id))

        if (uncheckedOrbits.length === 0) {
          console.log(`User ${sub.user_id}: All orbits checked, skipping`)
          continue
        }

        // Build notification message
        const orbitIcons = uncheckedOrbits.slice(0, 3).map(o => o.icon).join(' ')
        const orbitNames = uncheckedOrbits.length === 1
          ? uncheckedOrbits[0].name
          : `${uncheckedOrbits.length} orbits`

        const payload = JSON.stringify({
          title: `${orbitIcons} Time to check in!`,
          body: uncheckedOrbits.length === 1
            ? `Don't forget your ${uncheckedOrbits[0].name} check-in`
            : `${uncheckedOrbits.length} orbits waiting for today's check-in`,
          icon: '/orbit-icon.png',
          badge: '/orbit-badge.png',
          tag: 'orbit-checkin',
          data: { url: '/quick-checkin' }
        })

        // Build push subscription object
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        }

        // Send push notification
        await webpush.sendNotification(pushSubscription, payload)

        console.log(`Push sent to user ${sub.user_id} (${sub.device_name})`)
        results.push({ userId: sub.user_id, success: true })

        // Rate limit: 3 second delay between pushes
        await sleep(3000)

      } catch (err) {
        console.error(`Error sending to user ${sub.user_id}:`, err)
        results.push({ userId: sub.user_id, success: false, error: err.message })

        // If subscription is invalid, remove it
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log(`Removing invalid subscription for user ${sub.user_id}`)
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id)
        }
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    console.log(`Push notifications complete: ${successCount} sent, ${failCount} failed`)

    return new Response(
      JSON.stringify({
        message: 'Push notifications sent',
        sent: successCount,
        failed: failCount,
        details: results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Edge function error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
