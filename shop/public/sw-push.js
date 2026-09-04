/* Service worker minimal, dédié aux notifications push de /store — il ne fait
   QUE ça (pas de cache, pas de mode hors-ligne) : c'est le seul moyen pour une
   notification de "Nouvelle commande" d'atteindre le téléphone même onglet
   fermé ou écran verrouillé. */

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* payload non-JSON */ }
  const titre = data.title || '🛍️ Nouvelle commande';
  event.waitUntil(
    self.registration.showNotification(titre, {
      body: data.body || '',
      icon: '/icon-512.png',
      badge: '/icon-512.png',
      tag: data.tag || undefined,
      data: { url: data.url || '/store/commandes' },
      vibrate: [120, 60, 120],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/store/commandes';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) { if (c.url.includes('/store') && 'focus' in c) return c.focus(); }
      return self.clients.openWindow(url);
    })
  );
});
