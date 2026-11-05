/* « Où sont mes pièces ? » — en haut de la Liste des Colis : pièces chez le
 * livreur, retours (refusés / annulés / échanges) encore à récupérer ou déjà
 * rentrés, stock au local et pièces défectueuses, et le total.
 * On compte des PIÈCES (quantités des articles), pas des commandes. */
import { estColisRetour, estRecu, estEchangeARecevoir, dateAjout, estImportSheet } from './colisRetours';
import { groupeProduit } from './groupeProduit';

/** Statuts où le colis est chez la société de livraison, en route vers la cliente. */
export const EN_LIVRAISON = new Set(['att_ramassage', 'expedier', 'recu_livreur', 'pas_rep_lv', 'en_suivi']);

export function piecesDe(o) {
  const l = Array.isArray(o?.products) && o.products.length ? o.products : (o?.product?.name ? [o.product] : []);
  return l.reduce((n, p) => n + (Number(p?.qty) || 1), 0);
}

/* Un colis « chez le livreur » depuis plus de 45 jours sans bouger n'y est
   plus vraiment (statut jamais mis à jour) : on ne le compte pas. */
export const AGE_MAX_LIVRAISON_JOURS = 45;
const tropAncien = (o, maintenant) => {
  const t = dateAjout(o);
  return t > 0 && maintenant - t > AGE_MAX_LIVRAISON_JOURS * 864e5;
};

/** Comptes en pièces (et en colis) à partir des commandes. */
export function inventaire(orders, recuIds, maintenant = Date.now()) {
  const r = {
    enLivraison: { pieces: 0, colis: 0, parStatut: {}, anciensIgnores: 0 },
    refuses: { aRecuperer: 0, recus: 0 },
    annules: { aRecuperer: 0, recus: 0 },
    echanges: { aRecuperer: 0, recus: 0 },
    retoursColisARecuperer: 0,
  };
  for (const o of orders || []) {
    // Les commandes importées de Google Sheets (historique d'avant le système) ne comptent pas.
    if (o?.isDeleted || estImportSheet(o)) continue;
    const n = piecesDe(o);
    if (EN_LIVRAISON.has(o.status)) {
      if (tropAncien(o, maintenant)) { r.enLivraison.anciensIgnores += 1; continue; }
      r.enLivraison.pieces += n; r.enLivraison.colis += 1;
      r.enLivraison.parStatut[o.status] = (r.enLivraison.parStatut[o.status] || 0) + 1;
      continue;
    }
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

/* ── En dirhams ──
 * Coût d'achat d'une pièce : le prix du fournisseur pour son modèle
 * (Ensemble Hijab Sport 125, Ensemble Sport 100 — voir Fournisseur), sinon
 * le prix moyen réellement payé chez le fournisseur. */
export const PRIX_ACHAT = { 'ensemble hijab sport': 125, 'ensemble sport': 100 };
export function coutPiece(nom, prixMoyen = 100) {
  return PRIX_ACHAT[groupeProduit(nom)] ?? prixMoyen;
}
export function coutCommande(o, prixMoyen) {
  const l = Array.isArray(o?.products) && o.products.length ? o.products : (o?.product?.name ? [o.product] : []);
  return l.reduce((n, p) => n + coutPiece(p?.name, prixMoyen) * (Number(p?.qty) || 1), 0);
}

/** Valeur (achat et vente) de la marchandise hors du local. */
export function valeurs(orders, recuIds, prixMoyen, maintenant = Date.now()) {
  const v = { livreur: { achat: 0, vente: 0 }, aRecuperer: { achat: 0 } };
  for (const o of orders || []) {
    // Les commandes importées de Google Sheets (historique d'avant le système) ne comptent pas.
    if (o?.isDeleted || estImportSheet(o)) continue;
    if (EN_LIVRAISON.has(o.status)) {
      if (tropAncien(o, maintenant)) continue;
      v.livreur.achat += coutCommande(o, prixMoyen); v.livreur.vente += Number(o.price) || 0; continue;
    }
    if (estColisRetour(o) && !estRecu(o, recuIds)) v.aRecuperer.achat += coutCommande(o, prixMoyen);
  }
  return v;
}

/** Argent encore chez la société de livraison : colis livrés dont la facture
    n'est pas encore « versée ». Seulement depuis la plus ancienne facture
    enregistrée (avant, l'historique n'était pas facturé dans l'application). */
export function argentChezLivreur(orders, factures) {
  const verses = new Set(), factures_ = new Set();
  let depuis = Infinity;
  for (const f of factures || []) {
    for (const c of f.colis || []) {
      factures_.add(c.orderId);
      if (f.statut === 'paye') verses.add(c.orderId);
    }
    const t = dateFacture(f);
    if (t && t < depuis) depuis = t;
  }
  const r = { montant: 0, colis: 0, dontFacture: 0, depuis: Number.isFinite(depuis) ? depuis : null };
  for (const o of orders || []) {
    if (o?.isDeleted || o.status !== 'livre' || verses.has(o.id)) continue;
    if (r.depuis && dateAjout(o) < r.depuis) continue;
    r.montant += Number(o.price) || 0;
    r.colis += 1;
    if (factures_.has(o.id)) r.dontFacture += Number(o.price) || 0;
  }
  return r;
}
function dateFacture(f) {
  const m = String(f?.date || f?.dateCreation || f?.createdAt || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]).getTime();
  const d = Date.parse(f?.date || f?.createdAt || '');
  return Number.isFinite(d) ? d : 0;
}
