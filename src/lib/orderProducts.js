/* Ce qu'on propose à la saisie d'une commande.
 *
 * Le Stock héberge tout : ses propres articles, ceux rapatriés des plateformes
 * d'affiliation, et ceux qu'on ne vend plus. C'est ce qu'il faut pour le
 * réassort et l'historique — mais pas pour la liste où l'on choisit un produit,
 * qui les mélangeait tous. Des références qu'on ne vend pas soi-même
 * s'intercalaient entre les siennes, à chaque saisie.
 *
 * Deux exclusions, et deux seulement :
 *
 *  - la provenance, quand elle est connue : un article d'affiliation est rempli
 *    par sa plateforme, jamais choisi à la main ici ;
 *  - le statut : « Archived » ou « Draft » dit déjà qu'un article ne se vend
 *    pas. Se servir de ce qui existe évite d'inventer un second réglage disant
 *    la même chose — et laisse la main sur les articles dont la provenance
 *    n'est enregistrée nulle part.
 */
import { isOwnProduct } from './affiliatePlatforms';

/* Un article sans statut est actif : les produits d'origine n'en portaient pas,
   et les exclure aurait vidé la liste. */
export const isActiveProduct = (p) => !p?.statut || p.statut === 'Active';

/** Article proposable à la saisie d'une commande. */
export const isOrderableProduct = (p) => isOwnProduct(p) && isActiveProduct(p);

/** Catalogue proposé à la saisie d'une commande. */
export const orderableProducts = (list) => (list || []).filter(isOrderableProduct);
