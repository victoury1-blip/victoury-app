import { useEffect, useRef } from 'react';

const KNOWN_KEY = 'victoury_known_nouveau';

function getKnownIds() {
  try { return new Set(JSON.parse(localStorage.getItem(KNOWN_KEY) || '[]')); } catch { return new Set(); }
}

function saveKnownIds(ids) {
  localStorage.setItem(KNOWN_KEY, JSON.stringify([...ids]));
}

export function requestPermission() {
  return Promise.resolve('denied');
}

export default function useNotifications(orders) {
  const initRef = useRef(false);

  useEffect(() => {
    if (!orders || !orders.length) return;

    const nouveauOrders = orders.filter(o => o.status === 'nouveau');
    const nouveauIds = new Set(nouveauOrders.map(o => o.id));

    // Badging API only (number on app icon)
    if ('setAppBadge' in navigator) {
      if (nouveauIds.size > 0) navigator.setAppBadge(nouveauIds.size).catch(() => {});
      else navigator.clearAppBadge().catch(() => {});
    }

    // First load: just mark existing orders as known, no notifications
    if (!initRef.current) {
      initRef.current = true;
      const known = getKnownIds();
      for (const o of nouveauOrders) known.add(o.id);
      saveKnownIds(known);
      return;
    }

    // Clean known: keep only IDs still nouveau
    const known = getKnownIds();
    const cleaned = new Set([...known].filter(id => nouveauIds.has(id)));
    saveKnownIds(cleaned);
  }, [orders]);
}
