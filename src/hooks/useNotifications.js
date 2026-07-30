import { useEffect } from 'react';

export function requestPermission() {
  if (!('Notification' in window)) return Promise.resolve('denied');
  if (Notification.permission === 'granted') return Promise.resolve('granted');
  return Notification.requestPermission();
}

const BADGE_TAG = 'pending-orders-badge';

// La pastille = uniquement les commandes RÉELLEMENT NOUVELLES (statut « nouveau »
// : WooCommerce / ajout manuel), comme le badge WhatsApp. On EXCLUT les vieux
// statuts d'attente (en_attente/pas_rep…) issus des imports Google Sheets, qui
// gonflaient le chiffre sans être de vraies nouvelles commandes.
const NEW_STATUSES = new Set(['nouveau']);

/**
 * Affiche le nombre de commandes « à confirmer » sur l'icône de l'app.
 *
 * Deux mécanismes complémentaires, car l'API Badging (setAppBadge) SEULE ne
 * s'affiche pas sur les lanceurs Samsung/One UI :
 *   1. setAppBadge(count) — standard (fonctionne sur desktop / certains Android).
 *   2. Une notification PERSISTANTE et SILENCIEUSE portant le nombre : sur
 *      Samsung, c'est sa présence qui fait apparaître la pastille sur l'icône
 *      (comme WhatsApp). Elle est mise à jour (renotify:false = pas de son/vibration
 *      répétés) et retirée dès qu'il n'y a plus de commande à confirmer.
 *
 * `notifPerm` permet de ré-appliquer dès que l'autorisation passe à « granted ».
 */
export default function useNotifications(orders, notifPerm) {
  useEffect(() => {
    const count = (orders || []).filter(o => NEW_STATUSES.has(o.status)).length;

    // 1) Badging API
    if ('setAppBadge' in navigator) {
      if (count > 0) navigator.setAppBadge(count).catch(() => {});
      else navigator.clearAppBadge().catch(() => {});
    }

    // 2) Notification silencieuse persistante (pastille icône Samsung)
    if (!('serviceWorker' in navigator)) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    navigator.serviceWorker.ready.then(reg => {
      if (count > 0) {
        reg.showNotification('Victoury — nouvelles commandes', {
          body: `${count} nouvelle${count > 1 ? 's' : ''} commande${count > 1 ? 's' : ''}`,
          tag: BADGE_TAG,
          renotify: false,   // pas de son/vibration à chaque mise à jour
          silent: true,
          badge: '/pwa-192x192.png',
          icon: '/pwa-192x192.png',
          data: { url: '/commandes/a-confirmer' },
        }).catch(() => {});
      } else {
        // Plus rien à confirmer : retirer la pastille
        reg.getNotifications({ tag: BADGE_TAG })
          .then(list => list.forEach(n => n.close()))
          .catch(() => {});
      }
    }).catch(() => {});
  }, [orders, notifPerm]);
}
