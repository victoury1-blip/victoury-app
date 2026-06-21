import { useEffect, useRef, useCallback } from 'react';

const NOTIF_KEY = 'push_notifications';

function getConfig() {
  try { return JSON.parse(localStorage.getItem(NOTIF_KEY) || '{}'); } catch { return {}; }
}

function isEnabled() {
  return getConfig().enabled !== false && 'Notification' in window && Notification.permission === 'granted';
}

export function requestPermission() {
  if (!('Notification' in window)) return Promise.resolve('denied');
  if (Notification.permission === 'granted') return Promise.resolve('granted');
  return Notification.requestPermission();
}

export function sendNotification(title, options = {}) {
  if (!isEnabled()) return;
  try {
    const n = new Notification(title, {
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: options.tag || 'victoury',
      renotify: true,
      ...options,
    });
    if (options.onclick) n.onclick = options.onclick;
    setTimeout(() => n.close(), 8000);
  } catch {}
}

export default function useNotifications(orders) {
  const prevCountRef = useRef(null);
  const prevAlertsRef = useRef(new Set());

  const checkAlerts = useCallback((list) => {
    if (!isEnabled()) return;

    const pending = list.filter(o => o.status === 'nouveau');
    if (pending.length > 10) {
      const key = `pending-${pending.length}`;
      if (!prevAlertsRef.current.has(key)) {
        prevAlertsRef.current.add(key);
        sendNotification(`${pending.length} commandes en attente`, {
          body: 'Des commandes attendent la confirmation',
          tag: 'alert-pending',
        });
      }
    }

    const reported = list.filter(o => o.status === 'reporter');
    const today = new Date().toISOString().slice(0, 10);
    const overdue = reported.filter(o => o.reportDate && o.reportDate <= today);
    if (overdue.length) {
      const key = `overdue-${overdue.length}`;
      if (!prevAlertsRef.current.has(key)) {
        prevAlertsRef.current.add(key);
        const names = overdue.slice(0, 3).map(o => o.recipient?.name || o.id).join(', ');
        sendNotification(`${overdue.length} client${overdue.length > 1 ? 's' : ''} à rappeler aujourd'hui`, {
          body: names + (overdue.length > 3 ? '…' : ''),
          tag: 'alert-overdue',
        });
      }
    }

    const noLivreur = list.filter(o => o.status === 'confirme' && !o.recipient?.delivery);
    if (noLivreur.length) {
      const key = `nolivreur-${noLivreur.length}`;
      if (!prevAlertsRef.current.has(key)) {
        prevAlertsRef.current.add(key);
        sendNotification(`${noLivreur.length} commandes sans livreur`, {
          body: 'Commandes confirmées non assignées',
          tag: 'alert-nolivreur',
        });
      }
    }
  }, []);

  useEffect(() => {
    if (!orders || !orders.length) return;

    if (prevCountRef.current !== null) {
      const newCount = orders.length - prevCountRef.current;
      if (newCount > 0) {
        sendNotification(`${newCount} nouvelle${newCount > 1 ? 's' : ''} commande${newCount > 1 ? 's' : ''}`, {
          body: 'Cliquez pour voir les détails',
          tag: 'new-orders',
        });
      }
    }
    prevCountRef.current = orders.length;

    checkAlerts(orders);
  }, [orders, checkAlerts]);

  useEffect(() => {
    const interval = setInterval(() => {
      prevAlertsRef.current.clear();
    }, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
}
