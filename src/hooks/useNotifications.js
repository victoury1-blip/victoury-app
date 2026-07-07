import { useEffect } from 'react';

export function requestPermission() {
  if (!('Notification' in window)) return Promise.resolve('denied');
  if (Notification.permission === 'granted') return Promise.resolve('granted');
  return Notification.requestPermission();
}

const BADGE_TAG = 'pending-orders-badge';

/**
 * Affiche le nombre de commandes « à confirmer » sur l'icône de l'app.
 *
 * Sur Samsung/Android, l'API Badging (setAppBadge) NE SUFFIT PAS à afficher le
 * chiffre sur l'icône : le lanceur n'affiche la pastille que s'il existe une
 * notification active pour l'app. On maintient donc UNE seule notification
 * silencieuse (sans son ni vibration), taguée, qui se remplace elle-même à
 * chaque changement de compteur — ce n'est pas du spam : c'est une seule
 * notification persistante qui reflète le nombre en attente, et qui disparaît
 * dès qu'il n'y a plus de commande à confirmer.
 *
 * `notifPerm` est passé pour ré-appliquer dès que l'utilisateur accorde
 * l'autorisation (sinon rien ne s'affiche tant que la permission n'est pas
 * « granted »).
 */
export default function useNotifications(orders, notifPerm) {
  // Nettoyage unique d'anciennes notifications "badge-*" laissées par d'ex-versions.
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(reg => reg.getNotifications())
        .then(list => list.forEach(n => { if (n.tag?.startsWith('badge-')) n.close(); }))
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    const count = (orders || []).filter(o => o.status === 'nouveau').length;

    // 1) API Badging (fonctionne seule sur certains appareils / desktop).
    if ('setAppBadge' in navigator) {
      if (count > 0) navigator.setAppBadge(count).catch(() => {});
      else navigator.clearAppBadge().catch(() => {});
    }

    // 2) Notification silencieuse persistante -> force l'affichage de la pastille
    //    sur l'icône sous Android (Samsung). Nécessite l'autorisation accordée.
    const granted = typeof Notification !== 'undefined' && Notification.permission === 'granted';
    if (!('serviceWorker' in navigator) || !granted) return;

    navigator.serviceWorker.ready.then(reg => {
      if (count > 0) {
        reg.showNotification('VICTOURY', {
          body: count === 1 ? '1 commande à confirmer' : `${count} commandes à confirmer`,
          tag: BADGE_TAG,
          renotify: false,   // remplace en place, pas de re-sonnerie
          silent: true,      // ni son ni vibration
          badge: '/pwa-192x192.png',
          icon: '/pwa-192x192.png',
          data: { url: '/commandes/a-confirmer' },
        }).catch(() => {});
      } else {
        // plus rien en attente -> on retire la pastille
        reg.getNotifications({ tag: BADGE_TAG })
          .then(list => list.forEach(n => n.close()))
          .catch(() => {});
      }
    }).catch(() => {});
  }, [orders, notifPerm]);
}
