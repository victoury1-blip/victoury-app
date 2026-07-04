import { useEffect } from 'react';

export function requestPermission() {
  if (!('Notification' in window)) return Promise.resolve('denied');
  if (Notification.permission === 'granted') return Promise.resolve('granted');
  return Notification.requestPermission();
}

/**
 * Gère UNIQUEMENT le compteur (pastille) sur l'icône de l'app via l'API Badging.
 * Aucune notification visible n'est créée ici : celles-ci n'apparaissent que
 * lorsqu'une nouvelle commande arrive réellement (voir notifyNewOrder dans App.jsx).
 * On nettoie aussi d'anciennes notifications "badge-*" que d'anciennes versions
 * avaient pu laisser dans le tiroir.
 */
export default function useNotifications(orders) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(reg => reg.getNotifications())
        .then(list => list.forEach(n => { if (n.tag?.startsWith('badge-')) n.close(); }))
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!('setAppBadge' in navigator)) return;
    const count = (orders || []).filter(o => o.status === 'nouveau').length;
    if (count > 0) navigator.setAppBadge(count).catch(() => {});
    else navigator.clearAppBadge().catch(() => {});
  }, [orders]);
}
