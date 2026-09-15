import { cloudGet, cloudSet, localGet } from './cloudSettings';

/* Total de stock physique (compté à la main par l'admin dans le local),
 * complètement séparé du "Ajouter Stock" de StockPage (qui, lui, ajoute un
 * PRODUIT avec son propre stock par variation — sans rapport avec ce total
 * global). Un seul nombre, réglé manuellement, qui ne descend que d'une
 * façon : automatiquement, quand une commande passe au statut "Confirmé". */
const CLE = 'stock_manuel_total';

/* `parDefaut` : première fois que ce total est lu (jamais réglé à la main
 * avant), il vaut mieux repartir de la somme des variations produits que
 * de 0 — 0 se lisait comme "tout le stock a disparu" alors que ce total
 * manuel n'avait simplement jamais encore été saisi. Le seed n'a lieu
 * qu'une fois : dès qu'une vraie valeur existe (même 0, explicitement
 * réglée), elle est respectée. */
export async function chargerStockManuel(parDefaut) {
  const v = await cloudGet(CLE);
  if (typeof v === 'number') return v;
  if (typeof parDefaut === 'number') { definirStockManuel(parDefaut); return parDefaut; }
  return 0;
}

/** Lecture synchrone (cache local) — pour un premier affichage sans attendre le réseau. */
export function lireStockManuelCache() {
  const v = localGet(CLE);
  return typeof v === 'number' ? v : 0;
}

/* `await`-able exprès : `cloudSet` écrit le localStorage tout de suite, mais
 * son écriture Supabase part en arrière-plan — un rafraîchissement de page
 * juste après annule cette requête réseau en vol, et la valeur fraîchement
 * saisie n'atteint jamais la base. L'appelant (le bouton ✓ de Stock) attend
 * donc cette promesse avant de considérer l'enregistrement terminé, pour
 * pouvoir prévenir l'admin plutôt que de la laisser rafraîchir trop tôt. */
export async function definirStockManuel(total) {
  const propre = Math.max(0, Math.round(total) || 0);
  await cloudSet(CLE, propre);
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
