import { useEffect, useRef } from 'react';

const NOTIF_KEY = 'push_notifications';

export function requestPermission() {
  if (!('Notification' in window)) return Promise.resolve('denied');
  if (Notification.permission === 'granted') return Promise.resolve('granted');
  return Notification.requestPermission();
}

async function clearAllNotifications() {
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (!reg) return;
    const existing = await reg.getNotifications();
    for (const n of existing) n.close();
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

    const nouveauCount = orders.filter(o => o.status === 'nouveau').length;

    // Badge on app icon only — no tray notifications
    if ('setAppBadge' in navigator) {
      if (nouveauCount > 0) navigator.setAppBadge(nouveauCount).catch(() => {});
      else navigator.clearAppBadge().catch(() => {});
    }

    // Clear any leftover tray notifications from before
    clearAllNotifications();
  }, [orders]);
}
