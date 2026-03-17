// Orbit Edge Function: Send Push Notifications
// Uses npm:web-push for proper Web Push encryption

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    console.log('VAPID Public Key exists:', !!vapidPublicKey)
    console.log('VAPID Private Key exists:', !!vapidPrivateKey)

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: 'VAPID keys not configured in Supabase secrets' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Configure web-push
    webpush.setVapidDetails(
      'mailto:support@orbityours.com',
      vapidPublicKey,
      vapidPrivateKey
    )

    // Get all subscriptions
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('*')

    if (fetchError) {
      console.error('Database error:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Database error', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${subscriptions?.length || 0} subscriptions`)

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No subscriptions found', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results: { userId: string; device: string; success: boolean; error?: string }[] = []

    for (const sub of subscriptions) {
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
        console.log(`✓ Push sent to ${sub.device_name}`)
        results.push({ userId: sub.user_id, device: sub.device_name, success: true })

      } catch (err: any) {
        console.error(`✗ Failed for ${sub.device_name}:`, err.message)
        results.push({ userId: sub.user_id, device: sub.device_name, success: false, error: err.message })

        // Remove invalid subscription
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    }

    const sent = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    return new Response(
      JSON.stringify({ message: 'Done', sent, failed, results }),
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
