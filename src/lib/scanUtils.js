/**
 * Logique métier partagée des scanners (Ramassage, Retour, Liste des Colis).
 */

/** Statuts acceptés au scan retour : le statut est conservé, le colis passe "Reçu". */
export const RETOUR_ACCEPTED = new Set(['retour', 'annule', 'echange', 'refuse']);

/** Seul statut ramassable : passe à "expedier" au scan. */
export const RAMASSAGE_ACCEPTED = 'att_ramassage';

/**
 * Retrouve une commande par ID, tracking ou tracking Ozon (insensible à la casse).
 * @returns l'ordre trouvé ou undefined
 */
export function findOrderByCode(orders, rawCode) {
  const code = String(rawCode || '').trim();
  if (!code) return undefined;
  const lower = code.toLowerCase();
  return orders.find(o =>
    o.id === code ||
    o.trackingNumber === code ||
    o.ozoneTracking === code ||
    String(o.id || '').toLowerCase() === lower ||
    String(o.trackingNumber || '').toLowerCase() === lower ||
    String(o.ozoneTracking || '').toLowerCase() === lower
  );
}

/**
 * Règle métier du scan ramassage.
 * @returns { ok: true } ou { ok: false, reason }
 */
export function checkRamassageScan(order) {
  if (!order) return { ok: false, reason: 'not_found' };
  if (order.status === 'expedier') return { ok: false, reason: 'deja_expedier' };
  if (order.status !== RAMASSAGE_ACCEPTED) return { ok: false, reason: 'statut_invalide' };
  return { ok: true };
}

/**
 * Règle métier du scan retour.
 * @returns { ok: true } ou { ok: false, reason }
 */
export function checkRetourScan(order) {
  if (!order) return { ok: false, reason: 'not_found' };
  if (!RETOUR_ACCEPTED.has(order.status)) return { ok: false, reason: 'statut_invalide' };
  return { ok: true };
}
