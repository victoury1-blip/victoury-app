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

/** Colis refusé / annulé / en retour, issu de la Liste des Colis. */
export const estColisRetour = (o) => RETOUR_SET.has(o?.status) && estDansColis(o);

/** Liste locale héritée des colis cochés « reçu » avant la colonne orders.recu. */
export function lireRecuIdsLocal() {
  try { return new Set(JSON.parse(localStorage.getItem(RECU_KEY) || '[]')); } catch { return new Set(); }
}

/** Reçu au local : colonne de la commande, ou ancienne liste locale. */
export const estRecu = (o, recuIds) => !!o?.recu || !!recuIds?.has(o?.id);
