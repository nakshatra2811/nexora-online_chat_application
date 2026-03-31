// lib/push.ts
// Nexora Web Push Notification Service
// Registers service worker, subscribes to push, and sends subscription to server

import { API_BASE_URL } from './config';

class PushNotificationService {
  private registration: ServiceWorkerRegistration | null = null;

  /** Register the service worker */
  async init(): Promise<boolean> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('[Push] Push notifications not supported in this browser.');
      return false;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js');
      console.log('[Push] Service worker registered:', this.registration.scope);
      return true;
    } catch (err) {
      console.error('[Push] Service worker registration failed:', err);
      return false;
    }
  }

  /** Request permission and subscribe user to push */
  async subscribe(username: string): Promise<boolean> {
    if (!this.registration) {
      const ok = await this.init();
      if (!ok) return false;
    }

    try {
      // Check permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('[Push] Notification permission denied.');
        return false;
      }

      // Get VAPID public key from server
      const resp = await fetch(`${API_BASE_URL}/api/push/vapid-public-key`);
      if (!resp.ok) {
        console.warn('[Push] VAPID key not available — push notifications disabled.');
        return false;
      }
      const { key } = await resp.json();

      // Subscribe
      const subscription = await this.registration!.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(key).buffer as ArrayBuffer,
      });

      // Send subscription to server
      await fetch(`${API_BASE_URL}/api/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, subscription }),
      });

      console.log('[Push] Subscribed successfully for:', username);
      return true;
    } catch (err) {
      console.error('[Push] Subscription failed:', err);
      return false;
    }
  }

  /** Unsubscribe user from push */
  async unsubscribe(username: string): Promise<void> {
    try {
      if (this.registration) {
        const sub = await this.registration.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
      }
      await fetch(`${API_BASE_URL}/api/push/subscribe/${encodeURIComponent(username)}`, {
        method: 'DELETE',
      });
      console.log('[Push] Unsubscribed:', username);
    } catch (err) {
      console.error('[Push] Unsubscribe failed:', err);
    }
  }

  /** Show a local notification (when user is ON the page but chat is not active) */
  showLocalNotification(title: string, body: string, data?: Record<string, any>) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    // Only show if page is not visible
    if (document.visibilityState === 'visible') return;
    new Notification(title, {
      body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      data,
    });
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}

export const pushService = new PushNotificationService();
