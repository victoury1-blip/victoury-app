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

/** Initialise le compteur = plus grand VICT réellement présent dans les commandes
 *  (source de vérité). On IGNORE volontairement l'ancienne valeur stockée : si un
 *  renumérotage a fait redescendre les VICT, le compteur suit les commandes réelles
 *  (et non un compteur gonflé qui ferait sauter les numéros). `orders` doit être la
 *  liste COMPLÈTE chargée depuis Supabase (max global tous appareils confondus). */
const stored = () => parseInt(localStorage.getItem('vict_counter') || '0', 10) || 0;

/** Initialise le compteur. MONOTONE : max(commandes, valeur stockée) — ne descend
 *  jamais, sinon un numéro déjà émis serait réattribué (doublons VICT). Seule la
 *  migration peut forcer une valeur, via resetVictCounter(). */
export function initVictCounter(orders) {
  if (_victCounter !== null) return;
  _victCounter = Math.max(maxVictIn(orders), stored());
  localStorage.setItem('vict_counter', String(_victCounter));
  cloudSet('vict_counter', _victCounter);
}

/** Recalage MONOTONE : ne descend JAMAIS sous la valeur déjà atteinte. Indispensable
 *  car `orders` peut être partiel (liste pas encore chargée quand un import Woo
 *  arrive) : sans ce garde-fou le compteur retombait à 0 et réémettait VICT0001. */
export function recalcVictCounter(orders) {
  _victCounter = Math.max(maxVictIn(orders), stored(), _victCounter || 0);
  localStorage.setItem('vict_counter', String(_victCounter));
  cloudSet('vict_counter', _victCounter);
}

/** Force le compteur à une valeur donnée (migration : on repart juste après le
 *  dernier VICT légitime, en ignorant les numéros erronés encore en base). */
export function resetVictCounter(value) {
  _victCounter = value;
  localStorage.setItem('vict_counter', String(value));
  cloudSet('vict_counter', value);
}

export function generateVictId() {
  _victCounter = (_victCounter || 0) + 1;
  localStorage.setItem('vict_counter', String(_victCounter));
  cloudSet('vict_counter', _victCounter);
  return 'VICT' + String(_victCounter).padStart(4, '0');
}
