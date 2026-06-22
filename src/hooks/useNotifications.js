import { useEffect, useRef } from 'react';

const NOTIF_KEY = 'push_notifications';
const KNOWN_KEY = 'victoury_known_nouveau';

function isEnabled() {
  return 'Notification' in window && Notification.permission === 'granted';
}

function getKnownIds() {
  try { return new Set(JSON.parse(localStorage.getItem(KNOWN_KEY) || '[]')); } catch { return new Set(); }
}

function saveKnownIds(ids) {
  localStorage.setItem(KNOWN_KEY, JSON.stringify([...ids]));
}

export function requestPermission() {
  if (!('Notification' in window)) return Promise.resolve('denied');
  if (Notification.permission === 'granted') return Promise.resolve('granted');
  return Notification.requestPermission();
}

export default function useNotifications(orders) {
  const permAskedRef = useRef(false);
  const initRef = useRef(false);

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
    const nouveauIds = new Set(nouveauOrders.map(o => o.id));

    // Badging API
    if ('setAppBadge' in navigator) {
      if (nouveauIds.size > 0) navigator.setAppBadge(nouveauIds.size).catch(() => {});
      else navigator.clearAppBadge().catch(() => {});
    }

    if (!isEnabled()) { initRef.current = true; return; }

    const known = getKnownIds();

    // First load: save existing nouveau IDs without sending notifications
    if (!initRef.current) {
      initRef.current = true;
      for (const id of nouveauIds) known.add(id);
      saveKnownIds(known);
      return;
    }

    // Only notify brand-new orders (not seen before)
    const brandNew = nouveauOrders.filter(o => !known.has(o.id));
    if (brandNew.length > 0) {
      (async () => {
        try {
          const reg = await navigator.serviceWorker?.ready;
          if (!reg) return;
          for (const order of brandNew) {
            reg.showNotification(`${order.recipient?.name || order.id} — ${order.price || 0} DH`, {
              tag: `badge-${order.id}`,
              icon: '/pwa-192x192.png',
              badge: '/pwa-192x192.png',
              silent: true,
              requireInteraction: true,
            });
            known.add(order.id);
          }
          saveKnownIds(known);
        } catch {}
      })();
    }

    // Clean known: keep only IDs still nouveau
    const cleaned = new Set([...known].filter(id => nouveauIds.has(id)));
    saveKnownIds(cleaned);

    // Close notifications for orders no longer nouveau
    (async () => {
      try {
        const reg = await navigator.serviceWorker?.ready;
        if (!reg) return;
        const existing = await reg.getNotifications();
        for (const n of existing) {
          if (n.tag?.startsWith('badge-') && !nouveauIds.has(n.tag.replace('badge-', ''))) {
            n.close();
          }
        }
      } catch {}
    })();
  }, [orders]);
}
