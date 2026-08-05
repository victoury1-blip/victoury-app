import { cloudGet, cloudSet } from './cloudSettings';

/** Compteur d'ID VICTxxxx. Partagé entre OrdersPage et NewOrderModal. */
let _victCounter = null;

/** Plus grand numéro VICT trouvé sur une commande, en scannant À LA FOIS l'id
 *  ET le trackingNumber (les commandes confirmées portent leur VICT dans
 *  trackingNumber, pas dans l'id). Sans ça, le compteur ignore des numéros
 *  déjà émis et les réattribue -> collisions avec Ozon. */
/* Numéros ABERRANTS : lors d'un incident de renumérotage, des commandes ont reçu
 * des VICT à 4 chiffres bien au-dessus de la vraie série (VICT1393…). S'ils entrent
 * dans le calcul du maximum, chaque nouvelle commande repart de 1394 au lieu de
 * suivre la série réelle. On les exclut du compteur (sans jamais les modifier ici). */
export const VICT_ABERRANT_FROM = 1000;

function maxVictIn(orders) {
  let max = 0;
  for (const o of orders || []) {
    for (const val of [o.id, o.trackingNumber]) {
      const m = String(val || '').match(/^VICT(\d+)$/i);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n >= VICT_ABERRANT_FROM) continue;
        if (n > max) max = n;
      }
    }
  }
  return max;
}

/** Initialise le compteur = plus grand VICT réellement présent dans les commandes
 *  (source de vérité). On IGNORE volontairement l'ancienne valeur stockée : si un
 *  renumérotage a fait redescendre les VICT, le compteur suit les commandes réelles
 *  (et non un compteur gonflé qui ferait sauter les numéros). `orders` doit être la
 *  liste COMPLÈTE chargée depuis Supabase (max global tous appareils confondus). */
export function initVictCounter(orders) {
  if (_victCounter !== null) return;
  _victCounter = maxVictIn(orders);
  localStorage.setItem('vict_counter', String(_victCounter));
  cloudSet('vict_counter', _victCounter);
}

/** Recalage : le compteur suit le plus grand VICT présent dans la liste complète,
 *  sans jamais descendre sous ce qui a déjà été généré CETTE session (évite de
 *  réémettre un numéro qu'on vient d'attribuer avant que la commande soit en base). */
export function recalcVictCounter(orders) {
  _victCounter = Math.max(maxVictIn(orders), _victCounter || 0);
  localStorage.setItem('vict_counter', String(_victCounter));
  cloudSet('vict_counter', _victCounter);
}

export function generateVictId() {
  _victCounter = (_victCounter || 0) + 1;
  localStorage.setItem('vict_counter', String(_victCounter));
  cloudSet('vict_counter', _victCounter);
  return 'VICT' + String(_victCounter).padStart(4, '0');
}
