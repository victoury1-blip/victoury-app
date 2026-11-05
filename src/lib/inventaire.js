/* « Où sont mes pièces ? » — en haut de la Liste des Colis : pièces chez le
 * livreur, retours (refusés / annulés / échanges) encore à récupérer ou déjà
 * rentrés, stock au local et pièces défectueuses, et le total.
 * On compte des PIÈCES (quantités des articles), pas des commandes. */
import { estColisRetour, estRecu, estEchangeARecevoir } from './colisRetours';

/** Statuts où le colis est chez la société de livraison, en route vers la cliente. */
export const EN_LIVRAISON = new Set(['att_ramassage', 'expedier', 'recu_livreur', 'pas_rep_lv', 'en_suivi']);

export function piecesDe(o) {
  const l = Array.isArray(o?.products) && o.products.length ? o.products : (o?.product?.name ? [o.product] : []);
  return l.reduce((n, p) => n + (Number(p?.qty) || 1), 0);
}

/** Comptes en pièces (et en colis) à partir des commandes. */
export function inventaire(orders, recuIds) {
  const r = {
    enLivraison: { pieces: 0, colis: 0 },
    refuses: { aRecuperer: 0, recus: 0 },
    annules: { aRecuperer: 0, recus: 0 },
    echanges: { aRecuperer: 0, recus: 0 },
    retoursColisARecuperer: 0,
  };
  for (const o of orders || []) {
    if (o?.isDeleted) continue;
    const n = piecesDe(o);
    if (EN_LIVRAISON.has(o.status)) { r.enLivraison.pieces += n; r.enLivraison.colis += 1; continue; }
    if (!estColisRetour(o)) continue;
    const famille = estEchangeARecevoir(o) && !['refuse', 'annule', 'pret_retour', 'retour_recu'].includes(o.status)
      ? r.echanges : o.status === 'annule' ? r.annules : r.refuses;
    if (estRecu(o, recuIds)) famille.recus += n;
    else { famille.aRecuperer += n; r.retoursColisARecuperer += 1; }
  }
  r.aRecuperer = r.refuses.aRecuperer + r.annules.aRecuperer + r.echanges.aRecuperer;
  r.recus = r.refuses.recus + r.annules.recus + r.echanges.recus;
  return r;
}
