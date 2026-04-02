// Nexora Service Worker — Web Push Notification Handler
// Handles background push events and notification click actions

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Crypto utilities for Service Worker
function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function deriveKey() {
  const password = "super_secret_e2e_password_123";
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  return await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("nexora_salt_1337"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

async function decryptText(ciphertextBase64, ivBase64) {
  try {
    const key = await deriveKey();
    const cipherBuffer = base64ToBuffer(ciphertextBase64);
    const ivBuffer = base64ToBuffer(ivBase64);
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(ivBuffer) },
      key,
      cipherBuffer
    );
    return new TextDecoder().decode(decryptedBuffer);
  } catch (err) {
    return null;
  }
}

self.addEventListener('push', (event) => {
  if (!event.data) return;

  event.waitUntil((async () => {
    let payload;
    try {
      payload = event.data.json();
    } catch {
      payload = {
        title: 'Nexora',
        body: event.data.text() || 'New notification',
        data: {}
      };
    }

    const title = payload.title || 'Nexora';
    let body = payload.body || 'Encrypted Message is here 🔐';
    
    // Attempt decryption if ciphertext is provided
    if (payload.data && payload.data.ciphertext && payload.data.iv) {
      const decrypted = await decryptText(payload.data.ciphertext, payload.data.iv);
      if (decrypted) {
        body = decrypted;
      }
    } else if (payload.data && payload.data.text && !payload.data.ciphertext) {
      body = payload.data.text;
    } else if (payload.data) {
       if (payload.data.isMedia) body = '📎 Media Message';
       else if (payload.data.isLocation) body = '📍 Shared Location';
       else if (payload.data.isPoll) body = '🗳️ New Poll';
       else if (payload.data.isContact) body = '👤 Shared Contact';
    }

    const options = {
      body: body,
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

    return self.registration.showNotification(title, options);
  })());
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
