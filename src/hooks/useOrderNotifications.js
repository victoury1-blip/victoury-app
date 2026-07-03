import { useEffect, useRef, useCallback } from 'react';

export default function useOrderNotifications() {
  const permissionRef = useRef(typeof Notification !== 'undefined' ? Notification.permission : 'denied');

  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(p => { permissionRef.current = p; });
    } else {
      permissionRef.current = Notification.permission;
    }
  }, []);

  const notify = useCallback((title, body, { icon = '/pwa-192x192.png', tag, url } = {}) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const options = {
      body, icon, badge: '/pwa-192x192.png', tag,
      renotify: !!tag, vibrate: [120, 60, 120],
      data: { url: url || '/' },
    };
    // Priorité au Service Worker : la notif s'affiche même si l'onglet est en arrière-plan
    // (ou la PWA installée en arrière-plan), et supporte un bouton d'action.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(reg => reg.showNotification(title, { ...options, actions: [{ action: 'open', title: 'Voir' }] }))
        .catch(() => { try { const n = new Notification(title, options); n.onclick = () => { window.focus(); n.close(); }; } catch {} });
      return;
    }
    try { const n = new Notification(title, options); n.onclick = () => { window.focus(); n.close(); }; } catch {}
  }, []);

  const notifyNewOrder = useCallback((order) => {
    const name = order.recipient?.name || 'Client';
    const city = order.recipient?.city || '';
    const price = order.price ? ` — ${order.price} MAD` : '';
    notify(`🛍️ Nouvelle commande${city ? ` (${city})` : ''}`, `${name}${price}`, { tag: `order-${order.id}`, url: '/commandes/a-confirmer' });
  }, [notify]);

  return { notify, notifyNewOrder };
}
