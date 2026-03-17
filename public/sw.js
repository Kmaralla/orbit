// Orbit Service Worker for Push Notifications

self.addEventListener('install', (event) => {
  console.log('Orbit SW: Installing...')
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  console.log('Orbit SW: Activated')
  event.waitUntil(clients.claim())
})

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('Orbit SW: Push received')

  let data = {
    title: 'Time to check in!',
    body: 'Your orbits are waiting for today\'s check-in',
    icon: '/orbit-icon.png',
    badge: '/orbit-badge.png',
    tag: 'orbit-checkin',
    data: { url: '/quick-checkin' }
  }

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() }
    }
  } catch (e) {
    console.log('Orbit SW: Using default notification data')
  }

  const options = {
    body: data.body,
    icon: data.icon || '/orbit-icon.png',
    badge: data.badge || '/orbit-badge.png',
    tag: data.tag || 'orbit-checkin',
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: data.data || { url: '/quick-checkin' },
    actions: [
      { action: 'checkin', title: '✓ Check In Now' },
      { action: 'snooze', title: '⏰ Snooze 30min' }
    ]
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('Orbit SW: Notification clicked', event.action)

  event.notification.close()

  if (event.action === 'snooze') {
    // Schedule another notification in 30 minutes
    // (This would need backend support, for now just close)
    return
  }

  // Open the quick check-in page
  const urlToOpen = event.notification.data?.url || '/quick-checkin'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there's already an open window
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen)
          return client.focus()
        }
      }
      // Open new window if none exists
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    })
  )
})
