import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// VAPID public key - generate your own at https://vapidkeys.com/
// Store private key in Supabase secrets as VAPID_PRIVATE_KEY
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

// Debug: log VAPID key status
console.log('Push notifications config:', {
  hasVapidKey: !!VAPID_PUBLIC_KEY,
  vapidKeyLength: VAPID_PUBLIC_KEY?.length,
  serviceWorker: 'serviceWorker' in navigator,
  pushManager: 'PushManager' in window,
  notification: 'Notification' in window
})

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

function getDeviceName() {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Mac/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows'
  if (/Linux/.test(ua)) return 'Linux'
  return 'Unknown Device'
}

export function usePushNotifications(userId) {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    checkSupport()
  }, [])

  useEffect(() => {
    if (userId && isSupported) {
      checkExistingSubscription()
      trackDeviceUsage()
    }
  }, [userId, isSupported])

  const checkSupport = () => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setIsSupported(supported)
    if (!supported) setLoading(false)
  }

  const checkExistingSubscription = async () => {
    try {
      // Check if service worker is already registered (don't wait forever)
      const registrations = await navigator.serviceWorker.getRegistrations()
      if (registrations.length === 0) {
        // No service worker yet - that's fine, user hasn't subscribed before
        setLoading(false)
        return
      }

      const registration = await navigator.serviceWorker.ready
      const existingSub = await registration.pushManager.getSubscription()

      if (existingSub) {
        setSubscription(existingSub)
        setIsSubscribed(true)
      }
    } catch (err) {
      console.error('Error checking subscription:', err)
    }
    setLoading(false)
  }

  const trackDeviceUsage = async () => {
    if (!userId) return

    try {
      // Only track if service worker is already registered
      const registrations = await navigator.serviceWorker.getRegistrations()
      if (registrations.length === 0) return

      const registration = await navigator.serviceWorker.ready
      const existingSub = await registration.pushManager.getSubscription()

      if (existingSub) {
        // Update use count and last_used for this device
        await supabase
          .from('push_subscriptions')
          .update({
            last_used: new Date().toISOString(),
            use_count: supabase.sql`use_count + 1`
          })
          .eq('user_id', userId)
          .eq('endpoint', existingSub.endpoint)

        // Set this as primary if it has highest use count
        await updatePrimaryDevice(userId)
      }
    } catch (err) {
      console.error('Error tracking device:', err)
    }
  }

  const updatePrimaryDevice = async (userId) => {
    try {
      // Get all subscriptions for user
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('id, use_count')
        .eq('user_id', userId)
        .order('use_count', { ascending: false })

      if (subs && subs.length > 0) {
        // Reset all to non-primary
        await supabase
          .from('push_subscriptions')
          .update({ is_primary: false })
          .eq('user_id', userId)

        // Set highest use_count as primary
        await supabase
          .from('push_subscriptions')
          .update({ is_primary: true })
          .eq('id', subs[0].id)
      }
    } catch (err) {
      console.error('Error updating primary device:', err)
    }
  }

  const subscribe = async () => {
    const ua = navigator.userAgent
    const isIOS = /iPhone|iPad/.test(ua)
    const isAndroid = /Android/.test(ua)

    if (!isSupported) {
      if (isIOS) {
        // Check if running as PWA (standalone mode)
        const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches
        if (isStandalone) {
          setError('Push not available. Requires iOS 16.4+ with notifications enabled in Settings.')
        } else {
          setError('Add Orbit to Home Screen first, then open from there')
          alert('To enable push notifications on iPhone:\n\n1. Tap the Share button (box with arrow)\n2. Tap "Add to Home Screen"\n3. Open Orbit from your Home Screen\n4. Then enable push notifications\n\nNote: Requires iOS 16.4 or newer')
        }
      } else if (isAndroid) {
        setError('Use Chrome browser for push notifications')
        alert('Push notifications work best on Chrome for Android.\n\nIf you\'re using Chrome, check that notifications are enabled in your browser settings.')
      } else {
        setError('Push notifications not supported on this browser')
      }
      return false
    }

    if (!userId) {
      setError('Please log in first')
      return false
    }

    if (!VAPID_PUBLIC_KEY) {
      console.error('VITE_VAPID_PUBLIC_KEY is not set!')
      setError('Push notifications not configured. Contact support.')
      alert('Push notifications are not configured yet. The VAPID key needs to be added to the environment.')
      return false
    }

    setLoading(true)
    setError(null)

    try {
      // Request permission
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setError('Notification permission denied')
        setLoading(false)
        return false
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      // Subscribe to push
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      })

      // Save to Supabase
      const subJson = sub.toJSON()
      const { error: dbError } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          endpoint: subJson.endpoint,
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth,
          device_name: getDeviceName(),
          last_used: new Date().toISOString(),
          use_count: 1,
          is_primary: true // New subscription is primary by default
        }, {
          onConflict: 'user_id,endpoint'
        })

      if (dbError) throw dbError

      // Reset other devices to non-primary
      await supabase
        .from('push_subscriptions')
        .update({ is_primary: false })
        .eq('user_id', userId)
        .neq('endpoint', subJson.endpoint)

      setSubscription(sub)
      setIsSubscribed(true)
      setLoading(false)
      return true
    } catch (err) {
      console.error('Error subscribing:', err)
      // Show more specific error based on device
      const ua = navigator.userAgent
      const isAndroid = /Android/.test(ua)
      let errorMsg = err.message

      if (err.message?.includes('denied') || err.name === 'NotAllowedError') {
        if (isAndroid) {
          errorMsg = 'Permission denied. Go to Chrome Settings → Site Settings → Notifications'
        } else {
          errorMsg = 'Permission denied. Check browser notification settings.'
        }
      } else if (err.message?.includes('subscription') || err.name === 'AbortError') {
        errorMsg = 'Subscription failed. Try again.'
      } else if (err.code === 'PGRST' || err.message?.includes('42P01')) {
        errorMsg = 'Database error. Table may not exist.'
      } else if (err.message?.includes('push service')) {
        errorMsg = 'Push service error. Check internet connection.'
      }
      setError(errorMsg)
      setLoading(false)
      return false
    }
  }

  const unsubscribe = async () => {
    if (!subscription) return false

    setLoading(true)
    try {
      await subscription.unsubscribe()

      // Remove from Supabase
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', subscription.endpoint)

      setSubscription(null)
      setIsSubscribed(false)
      setLoading(false)
      return true
    } catch (err) {
      console.error('Error unsubscribing:', err)
      setError(err.message)
      setLoading(false)
      return false
    }
  }

  return {
    isSupported,
    isSubscribed,
    loading,
    error,
    subscribe,
    unsubscribe
  }
}
