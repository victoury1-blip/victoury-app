import { useEffect } from 'react';

export function requestPermission() {
  if (!('Notification' in window)) return Promise.resolve('denied');
  if (Notification.permission === 'granted') return Promise.resolve('granted');
  return Notification.requestPermission();
}

const BADGE_TAG = 'pending-orders-badge';

/**
 * Affiche le nombre de commandes « à confirmer » sur l'icône de l'app via
 * l'API Badging (setAppBadge). L'autorisation de notification étant désormais
 * demandée au premier geste (App.jsx), le badge s'applique sans qu'aucune
 * notification visible ne soit posée dans la barre — c'est ce que veut
 * l'utilisateur : uniquement le chiffre sur l'icône, rien dans le tiroir.
 *
 * `notifPerm` permet de ré-appliquer dès que l'autorisation passe à « granted ».
 */
export default function useNotifications(orders, notifPerm) {
  // Nettoyage des anciennes notifications persistantes ("badge-*" ou la
  // pastille silencieuse d'une version précédente) pour ne rien laisser dans
  // la barre.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready
      .then(reg => reg.getNotifications())
      .then(list => list.forEach(n => {
        if (n.tag === BADGE_TAG || n.tag?.startsWith('badge-')) n.close();
      }))
      .catch(() => {});
  }, [orders, notifPerm]);

  useEffect(() => {
    if (!('setAppBadge' in navigator)) return;
    const count = (orders || []).filter(o => o.status === 'nouveau').length;
    if (count > 0) navigator.setAppBadge(count).catch(() => {});
    else navigator.clearAppBadge().catch(() => {});
  }, [orders, notifPerm]);
}
