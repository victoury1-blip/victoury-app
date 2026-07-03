import { cloudGet, cloudSet } from './cloudSettings';

/** Compteur d'ID VICTxxxx. Partagé entre OrdersPage et NewOrderModal. */
let _victCounter = null;

export function initVictCounter(orders) {
  if (_victCounter !== null) return;
  let max = 0;
  for (const o of orders) {
    const m = (o.id || '').match(/^VICT(\d+)$/i);
    if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
  }
  const stored = parseInt(localStorage.getItem('vict_counter') || '0', 10);
  _victCounter = Math.max(max, stored);
  cloudGet('vict_counter').then(remote => {
    const r = parseInt(remote || '0', 10);
    if (r > _victCounter) _victCounter = r;
  }).catch(() => {});
}

export function recalcVictCounter(orders) {
  let max = 0;
  for (const o of orders) {
    const m = (o.id || '').match(/^VICT(\d+)$/i);
    if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
  }
  _victCounter = max;
  localStorage.setItem('vict_counter', String(_victCounter));
  cloudSet('vict_counter', _victCounter);
}

export function generateVictId() {
  _victCounter = (_victCounter || 0) + 1;
  localStorage.setItem('vict_counter', String(_victCounter));
  cloudSet('vict_counter', _victCounter);
  return 'VICT' + String(_victCounter).padStart(4, '0');
}
