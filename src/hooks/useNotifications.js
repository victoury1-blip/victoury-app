import { useEffect, useRef, useCallback } from 'react';

const NOTIF_KEY = 'push_notifications';
const NOTIFIED_KEY = 'victoury_notified_ids';

function getNotifiedIds() {
  try { return new Set(JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '[]')); } catch { return new Set(); }
}

function saveNotifiedIds(ids) {
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...ids]));
}

function isEnabled() {
  return 'Notification' in window && Notification.permission === 'granted';
}

export function requestPermission() {
  if (!('Notification' in window)) return Promise.resolve('denied');
  if (Notification.permission === 'granted') return Promise.resolve('granted');
  return Notification.requestPermission();
}

async function sendSWNotification(title, options = {}) {
  if (!isEnabled()) return;
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg) {
      reg.showNotification(title, {
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        renotify: true,
        vibrate: [200, 100, 200],
        ...options,
      });
    }
  } catch {}
}

async function closeStaleSWNotifications(nouveauIds) {
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (!reg) return;
    const existing = await reg.getNotifications();
    for (const n of existing) {
      if (n.tag?.startsWith('nouveau-') && !nouveauIds.has(n.tag.replace('nouveau-', ''))) {
        n.close();
      }
    }
  } catch {}
}

export default function useNotifications(orders) {
  const prevAlertsRef = useRef(new Set());
  const permAskedRef = useRef(false);
  const initRef = useRef(false);

  // Auto-request permission on first load
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

  const checkAlerts = useCallback((list) => {
    if (!isEnabled()) return;
    const reported = list.filter(o => o.status === 'reporter');
    const today = new Date().toISOString().slice(0, 10);
    const overdue = reported.filter(o => o.reportDate && o.reportDate <= today);
    if (overdue.length) {
      const key = `overdue-${overdue.length}`;
      if (!prevAlertsRef.current.has(key)) {
        prevAlertsRef.current.add(key);
        const names = overdue.slice(0, 3).map(o => o.recipient?.name || o.id).join(', ');
        sendSWNotification(`${overdue.length} client${overdue.length > 1 ? 's' : ''} à rappeler`, {
          body: names + (overdue.length > 3 ? '…' : ''),
          tag: 'alert-overdue',
        });
      }
    }
  }, []);

  useEffect(() => {
    if (!orders || !orders.length) return;

    const nouveauOrders = orders.filter(o => o.status === 'nouveau');
    const nouveauIds = new Set(nouveauOrders.map(o => o.id));

    // Update PWA badge
    if ('setAppBadge' in navigator) {
      if (nouveauIds.size > 0) navigator.setAppBadge(nouveauIds.size).catch(() => {});
      else navigator.clearAppBadge().catch(() => {});
    }

    if (!isEnabled()) { initRef.current = true; return; }

    // First load: remember existing nouveau IDs without sending notifications
    if (!initRef.current) {
      initRef.current = true;
      const notified = getNotifiedIds();
      for (const id of nouveauIds) notified.add(id);
      saveNotifiedIds(notified);
      closeStaleSWNotifications(nouveauIds);
      checkAlerts(orders);
      return;
    }

    const notified = getNotifiedIds();
    const brandNew = nouveauOrders.filter(o => !notified.has(o.id));

    // Notify only brand-new orders
    if (brandNew.length > 0) {
      (async () => {
        try {
          const reg = await navigator.serviceWorker?.ready;
          if (!reg) return;
          for (const order of brandNew) {
            const name = order.recipient?.name || order.id;
            reg.showNotification(`Commande ${order.id}`, {
              body: `${name} — ${order.price || 0} DH`,
              icon: '/pwa-192x192.png',
              badge: '/pwa-192x192.png',
              tag: `nouveau-${order.id}`,
              vibrate: [200, 100, 200],
              data: { orderId: order.id },
              requireInteraction: true,
            });
            notified.add(order.id);
          }
          saveNotifiedIds(notified);
        } catch {}
      })();
    }

    // Clean: keep only IDs still nouveau
    const cleaned = new Set([...notified].filter(id => nouveauIds.has(id)));
    saveNotifiedIds(cleaned);

    // Close SW notifications for orders no longer nouveau
    closeStaleSWNotifications(nouveauIds);

    checkAlerts(orders);
  }, [orders, checkAlerts]);

  useEffect(() => {
    const interval = setInterval(() => prevAlertsRef.current.clear(), 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
}
