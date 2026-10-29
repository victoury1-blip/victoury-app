/* Colis revenus (ou à revenir) de la société de livraison : refusés, annulés
 * après expédition, prêts pour le retour, retournés. Pour chacun, il faut
 * savoir si le paquet est physiquement rentré au local (« reçu ») ou s'il est
 * encore chez le transporteur.
 */
import { COLIS_PIPELINE_SET } from '../data/colisPipeline';

export const RETOUR_STATUSES = ['refuse', 'annule', 'pret_retour', 'retour_recu'];
const RETOUR_SET = new Set(RETOUR_STATUSES);

const RECU_KEY = 'victoury_recu_ids';

/** Le colis est passé par la Liste des Colis (même règle que cette page). */
export const estDansColis = (o) => COLIS_PIPELINE_SET.has(o?.status) || (!!o?.trackingNumber && !!o?.validated);

/* Colis importé depuis Google Sheets (historique d'avant le système) : il
 * porte le code du tableur comme identifiant ET comme code de suivi. Une
 * commande du système a, elle, un numéro de la série VI, ou un identifiant de
 * la boutique / d'une intégration (VS-, EXT-, WC-). Les imports récents sont
 * en plus marqués explicitement (recipient.importe = 'sheet'). */
export function estImportSheet(o) {
  if (o?.recipient?.importe === 'sheet') return true;
  const id = String(o?.id || '');
  if (!id || id !== String(o?.trackingNumber || '')) return false;
  if (/^VI\d+$/i.test(id)) return false;
  if (/^(VS|EXT|WC)-/i.test(id)) return false;
  return true;
}

/** Date d'ajout (« JJ/MM/AAAA HH:mm:ss ») en millisecondes, 0 si illisible. */
export function dateAjout(o) {
  const t = String(o?.dateAdded || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (t) return new Date(+t[3], +t[2] - 1, +t[1], +(t[4] || 0), +(t[5] || 0), +(t[6] || 0)).getTime();
  const d = Date.parse(o?.createdAt || o?.dateAdded || '');
  return Number.isFinite(d) ? d : 0;
}

/* Échange : le livreur rapporte l'ancien article, qui doit lui aussi être
 * pointé « reçu » au local. Seulement à partir du 1ᵉʳ octobre 2026 : les
 * échanges plus anciens sont rentrés depuis longtemps sans avoir jamais été
 * pointés, ils auraient noyé la liste sous des « Non-reçu » qui n'en sont pas. */
export const DEBUT_ECHANGES_A_RECEVOIR = new Date(2026, 9, 1).getTime();
const STATUTS_ECHANGE = new Set(['change', 'echange_recu']);
export const estEchange = (o) => !!o?.echange || STATUTS_ECHANGE.has(o?.status);
export const estEchangeARecevoir = (o) =>
  estEchange(o) && estDansColis(o) && !estImportSheet(o) && dateAjout(o) >= DEBUT_ECHANGES_A_RECEVOIR;

/** Colis refusé / annulé / en retour, ou échange dont l'ancien article revient,
    issu de la Liste des Colis (hors import Google Sheets). */
export const estColisRetour = (o) =>
  (RETOUR_SET.has(o?.status) && estDansColis(o) && !estImportSheet(o)) || estEchangeARecevoir(o);

/** Liste locale héritée des colis cochés « reçu » avant la colonne orders.recu. */
export function lireRecuIdsLocal() {
  try { return new Set(JSON.parse(localStorage.getItem(RECU_KEY) || '[]')); } catch { return new Set(); }
}

/** Reçu au local : colonne de la commande, ou ancienne liste locale. Le
    statut « Échange » (echange_recu, posé par le scan des retours) vaut reçu
    tant qu'il n'a pas été explicitement décoché. */
export const estRecu = (o, recuIds) => !!o?.recu || !!recuIds?.has(o?.id)
  || (o?.status === 'echange_recu' && o?.recu !== false);
