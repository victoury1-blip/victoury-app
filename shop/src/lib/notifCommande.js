/* Notification système "nouvelle commande" — même principe que
   useOrderNotifications côté application principale, en plus simple : pas de
   Service Worker à poser pour l'admin (l'onglet doit rester ouvert, même en
   arrière-plan, pour recevoir la notification — normal sans serveur push). */
export function demanderPermissionNotif() {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'default') Notification.requestPermission();
}

export function notifierNouvelleCommande(commande) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const nom = commande?.recipient?.name || 'Client';
  const ville = commande?.recipient?.city || '';
  const prix = commande?.price ? ` — ${commande.price} DH` : '';
  try {
    const n = new Notification(`🛍️ Nouvelle commande${ville ? ` (${ville})` : ''}`, {
      body: `${nom}${prix}`,
      icon: '/icon-512.png',
      tag: `commande-${commande?.id}`,
    });
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* navigateur sans support Notification, ou permission retirée entre-temps */ }
}
