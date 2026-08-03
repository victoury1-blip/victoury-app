import { cloudGet, cloudSet } from './cloudSettings';

/** Compteur d'ID VICTxxxx. Partagé entre OrdersPage et NewOrderModal. */
let _victCounter = null;

/** Au-delà de ce seuil, un VICT provient de l'ancien backfill erroné (il était
 *  monté à ~1400). La série réelle est bien en dessous : on ignore ces numéros
 *  pour ne jamais « repartir » de 1392, 1395, … */
const GARBAGE = 100;

const storedCounter = () => parseInt(localStorage.getItem('vict_counter') || '0', 10) || 0;

/** Plus grand numéro VICT LÉGITIME (< GARBAGE) trouvé sur les commandes, en scannant
 *  à la fois l'id et le trackingNumber. Sert uniquement d'amorçage sur un appareil
 *  qui n'a pas encore de compteur local. */
function maxLegitVictIn(orders) {
  let max = 0;
  for (const o of orders || []) {
    for (const val of [o.id, o.trackingNumber]) {
      const m = String(val || '').match(/^VICT(\d+)$/i);
      if (!m) continue;
      const n = parseInt(m[1], 10);
      if (n > max && n < GARBAGE) max = n;
    }
  }
  return max;
}

/** Le compteur est la SOURCE DE VÉRITÉ (localStorage + cloud). On ne le recalcule
 *  pas à partir des commandes : d'anciens numéros erronés encore présents en base
 *  le feraient bondir. Amorçage depuis les commandes seulement si aucun compteur. */
export function initVictCounter(orders) {
  if (_victCounter !== null) return;
  const s = storedCounter();
  _victCounter = s > 0 ? s : maxLegitVictIn(orders);
  localStorage.setItem('vict_counter', String(_victCounter));
  cloudSet('vict_counter', _victCounter);
  // Un autre appareil peut être plus avancé : on s'aligne sur le maximum.
  cloudGet('vict_counter').then(remote => {
    const r = parseInt(remote || '0', 10) || 0;
    if (r > (_victCounter || 0)) {
      _victCounter = r;
      localStorage.setItem('vict_counter', String(r));
    }
  }).catch(() => {});
}

/** Recalage MONOTONE sur la valeur stockée (aucune lecture des commandes). */
export function recalcVictCounter() {
  _victCounter = Math.max(storedCounter(), _victCounter || 0);
  localStorage.setItem('vict_counter', String(_victCounter));
  cloudSet('vict_counter', _victCounter);
}

/** Force le compteur (correction ponctuelle d'un compteur corrompu). */
export function resetVictCounter(value) {
  _victCounter = value;
  localStorage.setItem('vict_counter', String(value));
  cloudSet('vict_counter', value);
}

/** Plus grand numéro légitime présent dans les commandes (utilitaire de correction). */
export function maxLegitVict(orders) {
  return maxLegitVictIn(orders);
}

export function generateVictId() {
  _victCounter = (_victCounter || 0) + 1;
  localStorage.setItem('vict_counter', String(_victCounter));
  cloudSet('vict_counter', _victCounter);
  return 'VICT' + String(_victCounter).padStart(4, '0');
}
