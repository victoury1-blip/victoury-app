/**
 * Logique métier partagée des scanners (Ramassage, Retour, Liste des Colis).
 */

export interface Order {
  id: string;
  trackingNumber?: string;
  ozoneTracking?: string;
  status: string;
  recipient?: {
    name?: string;
    phone?: string;
    city?: string;
    address?: string;
    delivery?: string;
  };
  price?: number;
  products?: Array<{ name?: string; color?: string; size?: string; qty?: number }>;
  product?: { name?: string };
  recu?: boolean;
  [key: string]: unknown;
}

export type ScanCheck =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'deja_expedier' | 'statut_invalide' };

/** Statuts acceptés au scan retour : le statut est conservé, le colis passe "Reçu". */
export const RETOUR_ACCEPTED: ReadonlySet<string> = new Set(['pret_retour', 'retour_recu', 'annule', 'change', 'refuse']);

/** Seul statut ramassable : passe à "expedier" au scan. */
export const RAMASSAGE_ACCEPTED = 'att_ramassage';

/**
 * Retrouve une commande par ID, tracking ou tracking Ozon (insensible à la casse).
 */
export function findOrderByCode(orders: Order[], rawCode: unknown): Order | undefined {
  const code = String(rawCode ?? '').trim();
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

/** Règle métier du scan ramassage. */
export function checkRamassageScan(order: Order | undefined): ScanCheck {
  if (!order) return { ok: false, reason: 'not_found' };
  if (order.status === 'expedier') return { ok: false, reason: 'deja_expedier' };
  if (order.status !== RAMASSAGE_ACCEPTED) return { ok: false, reason: 'statut_invalide' };
  return { ok: true };
}

/** Règle métier du scan retour. */
export function checkRetourScan(order: Order | undefined): ScanCheck {
  if (!order) return { ok: false, reason: 'not_found' };
  if (!RETOUR_ACCEPTED.has(order.status)) return { ok: false, reason: 'statut_invalide' };
  return { ok: true };
}
