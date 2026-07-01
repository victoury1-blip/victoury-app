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

  const notify = useCallback((title, body, { icon = '/pwa-192x192.png', tag } = {}) => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    try {
      const n = new Notification(title, { body, icon, tag });
      n.onclick = () => { window.focus(); n.close(); };
    } catch {}
  }, []);

  const notifyNewOrder = useCallback((order) => {
    const name = order.recipient?.name || 'Client';
    const city = order.recipient?.city || '';
    const price = order.price ? ` — ${order.price} MAD` : '';
    notify(`🛍️ Nouvelle commande${city ? ` (${city})` : ''}`, `${name}${price}`, { tag: `order-${order.id}` });
  }, [notify]);

  return { notify, notifyNewOrder };
}
