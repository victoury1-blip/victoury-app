/* Ce que paie le client.
 *
 * Trois choses s'empilent, et l'ordre compte : la remise par quantité, puis le
 * code promo, puis la livraison. Les intervertir donnerait un total différent
 * de celui annoncé sur la fiche produit — et une réclamation à la livraison.
 */

/** Nombre d'articles dans le panier, quantités comprises. */
export const nbArticles = (lignes) => lignes.reduce((n, l) => n + (l.qty || 0), 0);

export const sousTotal = (lignes) => lignes.reduce((s, l) => s + (l.price || 0) * (l.qty || 0), 0);

/* Remise par quantité : « la 2ᵉ paire à −20 %, la 3ᵉ à −30 % ».
 *
 * Elle porte sur les articles les MOINS chers. C'est la règle du commerce, et
 * la seule défendable : appliquée aux plus chers, elle coûterait davantage au
 * marchand pour une promesse identique au client. */
export function remiseQuantite(lignes, paliers = []) {
  if (!paliers.length) return 0;
  // Un article de quantité 3 vaut trois articles pour le décompte.
  const prix = [];
  for (const l of lignes) for (let i = 0; i < (l.qty || 0); i++) prix.push(l.price || 0);
  if (prix.length < 2) return 0;
  prix.sort((a, b) => b - a); // du plus cher au moins cher
  let remise = 0;
  for (let rang = 2; rang <= prix.length; rang++) {
    // Le palier applicable est le plus élevé dont le rang est atteint.
    const p = paliers.filter(x => rang >= x.rang).sort((a, b) => b.rang - a.rang)[0];
    if (p) remise += prix[rang - 1] * (p.pourcent / 100);
  }
  return arrondi(remise);
}

/** Remise d'un code promo, sur le montant déjà remisé. */
export function remisePromo(montant, promo) {
  if (!promo || montant <= 0) return 0;
  if (promo.kind === 'amount') return arrondi(Math.min(promo.value, montant));
  return arrondi(montant * (promo.value / 100));
}

/* Deux décimales, et pas davantage : un centime de dérive entre la fiche, le
   panier et la facture suffit à faire douter le client. */
export const arrondi = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Détail complet du panier — c'est ce qui s'affiche ET ce qui est facturé. */
export function totalPanier(lignes, { paliers = [], promo = null, livraison = 0 } = {}) {
  const st = arrondi(sousTotal(lignes));
  const rq = remiseQuantite(lignes, paliers);
  const apresQuantite = arrondi(st - rq);
  const rp = remisePromo(apresQuantite, promo);
  const total = arrondi(apresQuantite - rp + (livraison || 0));
  return {
    sousTotal: st,
    remiseQuantite: rq,
    remisePromo: rp,
    livraison: arrondi(livraison),
    total: Math.max(0, total),
    articles: nbArticles(lignes),
  };
}

/** Prix affiché sur une fiche, formaté comme le reste du site. */
export const fmtPrix = (n) => `${Number(n || 0).toLocaleString('fr-MA', {
  minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2,
  maximumFractionDigits: 2,
})} DH`;
