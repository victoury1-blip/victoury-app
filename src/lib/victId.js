import { cloudGet, cloudSet } from './cloudSettings';

/** Compteur d'ID VICTxxxx. Partagé entre OrdersPage et NewOrderModal. */
let _victCounter = null;

/** Plus grand numéro VICT trouvé sur une commande, en scannant À LA FOIS l'id
 *  ET le trackingNumber (les commandes confirmées portent leur VICT dans
 *  trackingNumber, pas dans l'id). Sans ça, le compteur ignore des numéros
 *  déjà émis et les réattribue -> collisions avec Ozon. */
function maxVictIn(orders) {
  let max = 0;
  for (const o of orders || []) {
    for (const val of [o.id, o.trackingNumber]) {
      const m = String(val || '').match(/^VICT(\d+)$/i);
      if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
    }
  }
  return max;
}

export function initVictCounter(orders) {
  if (_victCounter !== null) return;
  const stored = parseInt(localStorage.getItem('vict_counter') || '0', 10);
  _victCounter = Math.max(maxVictIn(orders), stored);
  cloudGet('vict_counter').then(remote => {
    const r = parseInt(remote || '0', 10);
    if (r > _victCounter) _victCounter = r;
  }).catch(() => {});
}

/** Recalage du compteur. MONOTONE : ne descend JAMAIS en dessous de la valeur
 *  déjà atteinte (localStorage) ni du plus grand VICT encore présent — sinon un
 *  numéro déjà envoyé à Ozon serait réémis pour une autre commande. */
export function recalcVictCounter(orders) {
  const stored = parseInt(localStorage.getItem('vict_counter') || '0', 10);
  _victCounter = Math.max(maxVictIn(orders), stored, _victCounter || 0);
  localStorage.setItem('vict_counter', String(_victCounter));
  cloudSet('vict_counter', _victCounter);
}

export function generateVictId() {
  _victCounter = (_victCounter || 0) + 1;
  localStorage.setItem('vict_counter', String(_victCounter));
  cloudSet('vict_counter', _victCounter);
  return 'VICT' + String(_victCounter).padStart(4, '0');
}
