import { cloudGet, cloudSet, localGet } from './cloudSettings';

/* Total de stock physique (compté à la main par l'admin dans le local),
 * complètement séparé du "Ajouter Stock" de StockPage (qui, lui, ajoute un
 * PRODUIT avec son propre stock par variation — sans rapport avec ce total
 * global). Un seul nombre, réglé manuellement, qui ne descend que d'une
 * façon : automatiquement, quand une commande passe au statut "Confirmé". */
const CLE = 'stock_manuel_total';

export async function chargerStockManuel() {
  const v = await cloudGet(CLE);
  return typeof v === 'number' ? v : 0;
}

/** Lecture synchrone (cache local) — pour un premier affichage sans attendre le réseau. */
export function lireStockManuelCache() {
  const v = localGet(CLE);
  return typeof v === 'number' ? v : 0;
}

export function definirStockManuel(total) {
  const propre = Math.max(0, Math.round(total) || 0);
  cloudSet(CLE, propre);
  return propre;
}

/* Nombre de pièces dans une commande = somme des quantités de chaque
 * produit (order.products, ou l'unique order.product s'il n'y a pas de
 * liste) — le même calcul que celui affiché sur la fiche commande ("Nx"). */
export function nbPieces(order) {
  const prods = order?.products?.length ? order.products : [order?.product].filter(Boolean);
  return prods.reduce((n, p) => n + (p?.qty || 1), 0);
}

/** Décrémente le total manuel du nombre de pièces d'UNE commande qui vient de passer à "Confirmé". */
export function decrementerStockManuel(order) {
  const qte = nbPieces(order);
  if (!qte) return;
  return definirStockManuel(lireStockManuelCache() - qte);
}

/* Une commande DÉJÀ confirmée peut ensuite être modifiée (le client rajoute
 * une pièce, par exemple) sans jamais changer de statut — un simple "encore
 * confirmée avant/après" ne suffit donc pas à savoir si le stock a bougé.
 * On compare le nombre de pièces avant/après : le stock ne descend (ou ne
 * remonte, si des pièces sont retirées) QUE de la différence. */
export function ajusterStockManuelSiConfirmeeModifiee(avant, apres) {
  if (avant?.status !== 'confirme' || apres?.status !== 'confirme') return;
  const delta = nbPieces(apres) - nbPieces(avant);
  if (!delta) return;
  return definirStockManuel(lireStockManuelCache() - delta);
}
