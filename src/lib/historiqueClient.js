/* Passé d'un client (même numéro) : combien de colis livrés, refusés,
 * annulés — pour savoir avant d'expédier si on peut lui faire confiance. */

const LIVRES = new Set(['livre', 'livré', 'echange_recu']);
const REFUSES = new Set(['refuse', 'refusé', 'retour_recu', 'pret_retour', 'injoignable', 'black_liste']);
const ANNULES = new Set(['annule', 'annulé']);

/** 9 derniers chiffres : 0696076672, +212696076672 et 212696076672 se valent. */
export const cleTelephone = (t) => String(t || '').replace(/\D/g, '').slice(-9);

/** { livres, refuses, annules, autres, total } — sans la commande `exclureId`. */
export function historiqueClient(orders, telephone, exclureId) {
  const cle = cleTelephone(telephone);
  const r = { livres: 0, refuses: 0, annules: 0, autres: 0, total: 0 };
  if (cle.length < 9) return r;
  for (const o of orders || []) {
    if (!o || o.id === exclureId || o.is_deleted || o.isDeleted) continue;
    if (cleTelephone(o.recipient?.phone) !== cle) continue;
    r.total++;
    if (LIVRES.has(o.status)) r.livres++;
    else if (REFUSES.has(o.status)) r.refuses++;
    else if (ANNULES.has(o.status)) r.annules++;
    else r.autres++;
  }
  return r;
}

/** 'nouveau' | 'fiable' | 'risque' | 'mitige' */
export function niveauClient(h) {
  if (!h.livres && !h.refuses && !h.annules) return 'nouveau';
  if (h.refuses + h.annules === 0) return 'fiable';
  if (h.livres === 0) return 'risque';
  return 'mitige';
}
