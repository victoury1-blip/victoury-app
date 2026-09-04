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
  // Détail complet (ville, produit) directement dans la notification : sans
  // ça, il fallait ouvrir l'onglet Commandes juste pour savoir de quoi il
  // s'agit avant même de décider si ça presse.
  const produits = commande?.products?.length ? commande.products : (commande?.product ? [commande.product] : []);
  const ligneProduit = produits[0]
    ? `📦 ${produits[0].name}${produits.length > 1 ? ` +${produits.length - 1}` : ''} (${produits[0].qty || 1}x)`
    : '';
  const corps = [`${nom}${prix}`, ville ? `📍 ${ville}` : '', ligneProduit].filter(Boolean).join('\n');
  try {
    const n = new Notification(`🛍️ Nouvelle commande${ville ? ` (${ville})` : ''}`, {
      body: corps,
      icon: '/icon-512.png',
      tag: `commande-${commande?.id}`,
    });
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* navigateur sans support Notification, ou permission retirée entre-temps */ }
}
