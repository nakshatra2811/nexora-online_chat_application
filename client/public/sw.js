// Nexora Service Worker — Web Push Notification Handler
// Handles background push events and notification click actions

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: 'Nexora',
      body: event.data.text() || 'New notification',
    };
  }

  const title = payload.title || 'Nexora';
  const options = {
    body: payload.body || 'Encrypted Message is here 🔐',
    icon: payload.icon || '/icon.svg',
    badge: payload.badge || '/icon.svg',
    vibrate: [200, 100, 200],
    data: payload.data || {},
    actions: [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    tag: 'nexora-notification',
    renotify: true,
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  // Focus or open the app
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          return client.focus();
        }
      }
      // No open window — open a new one
      return self.clients.openWindow('/dashboard/chats');
    })
  );
});
