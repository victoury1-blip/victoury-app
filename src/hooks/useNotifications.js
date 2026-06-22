import { useEffect, useRef } from 'react';

const NOTIF_KEY = 'push_notifications';

function isEnabled() {
  return 'Notification' in window && Notification.permission === 'granted';
}

export function requestPermission() {
  if (!('Notification' in window)) return Promise.resolve('denied');
  if (Notification.permission === 'granted') return Promise.resolve('granted');
  return Notification.requestPermission();
}

async function syncBadgeNotifications(nouveauOrders) {
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (!reg) return;

    const existing = await reg.getNotifications();
    const existingTags = new Set(existing.map(n => n.tag));
    const wantedTags = new Set(nouveauOrders.map(o => `badge-${o.id}`));

    // Close notifications for orders no longer nouveau
    for (const n of existing) {
      if (n.tag?.startsWith('badge-') && !wantedTags.has(n.tag)) {
        n.close();
      }
    }

    // Add silent notifications for new nouveau orders (for Samsung badge count)
    for (const order of nouveauOrders) {
      const tag = `badge-${order.id}`;
      if (!existingTags.has(tag)) {
        reg.showNotification(`${order.recipient?.name || order.id} — ${order.price || 0} DH`, {
          tag,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          silent: true,
          requireInteraction: true,
        });
      }
    }
  } catch {}
}

export default function useNotifications(orders) {
  const permAskedRef = useRef(false);

  useEffect(() => {
    if (permAskedRef.current) return;
    permAskedRef.current = true;
    if ('Notification' in window && Notification.permission === 'default') {
      const timer = setTimeout(() => {
        Notification.requestPermission().then(p => {
          if (p === 'granted') {
            localStorage.setItem(NOTIF_KEY, JSON.stringify({ enabled: true }));
          }
        });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (!orders || !orders.length) return;

    const nouveauOrders = orders.filter(o => o.status === 'nouveau');

    // Badging API (works on some browsers)
    if ('setAppBadge' in navigator) {
      if (nouveauOrders.length > 0) navigator.setAppBadge(nouveauOrders.length).catch(() => {});
      else navigator.clearAppBadge().catch(() => {});
    }

    // Samsung badge = notification count in tray
    if (isEnabled()) {
      syncBadgeNotifications(nouveauOrders);
    }
  }, [orders]);
}
