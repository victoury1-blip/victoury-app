import { useEffect, useRef } from 'react';

const KNOWN_KEY = 'victoury_known_nouveau';

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

async function syncBadge(nouveauOrders, nouveauIds) {
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (!reg) return;

    const existing = await reg.getNotifications();
    const activeIds = new Set(existing.map(n => n.tag?.replace('badge-', '')).filter(Boolean));

    // Close notifications for orders no longer nouveau
    for (const n of existing) {
      const id = n.tag?.replace('badge-', '');
      if (id && !nouveauIds.has(id)) n.close();
    }

    // Add silent notifications for new nouveau orders (for Samsung badge count)
    for (const order of nouveauOrders) {
      if (!activeIds.has(order.id)) {
        reg.showNotification('VICTOURY', {
          tag: `badge-${order.id}`,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          silent: true,
          body: `${order.recipient?.name || order.id} — ${order.price || 0} DH`,
        });
      }
    }
  } catch {}

  if ('setAppBadge' in navigator) {
    if (nouveauIds.size > 0) navigator.setAppBadge(nouveauIds.size).catch(() => {});
    else navigator.clearAppBadge().catch(() => {});
  }
}

export default function useNotifications(orders) {
  const initRef = useRef(false);

  useEffect(() => {
    if (!orders || !orders.length) return;

    const nouveauOrders = orders.filter(o => o.status === 'nouveau');
    const nouveauIds = new Set(nouveauOrders.map(o => o.id));

    if (!('Notification' in window) || Notification.permission !== 'granted') {
      if ('setAppBadge' in navigator) {
        if (nouveauIds.size > 0) navigator.setAppBadge(nouveauIds.size).catch(() => {});
        else navigator.clearAppBadge().catch(() => {});
      }
      if (!initRef.current) initRef.current = true;
      return;
    }

    syncBadge(nouveauOrders, nouveauIds);

    if (!initRef.current) {
      initRef.current = true;
      const known = getKnownIds();
      for (const o of nouveauOrders) known.add(o.id);
      saveKnownIds(known);
    }

    const known = getKnownIds();
    const cleaned = new Set([...known].filter(id => nouveauIds.has(id)));
    saveKnownIds(cleaned);
  }, [orders]);
}
