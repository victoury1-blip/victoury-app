/* Ce que paie le client.
 *
 * Trois choses s'empilent, et l'ordre compte : la remise par quantité, puis le
 * code promo, puis la livraison. Les intervertir donnerait un total différent
 * de celui annoncé sur la fiche produit — et une réclamation à la livraison.
 */
import { paliersEffectifs } from './remises';

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

/* Une remise peut être limitée à une collection (/store/remises). Le panier
 * mélange souvent plusieurs collections : chaque groupe (par collectionId)
 * applique ses propres paliers effectifs (règles globales + celles ciblant
 * justement sa collection), et les remises se cumulent groupe par groupe —
 * jamais une remise "Ensemble Sport" appliquée à une robe dans le même panier. */
export function remiseQuantiteGroupee(lignes, remises = []) {
  if (!remises?.length) return 0;
  const actifs = remises.filter(r => r.active && r.type !== 'inactive');
  // Collections qui ont leur propre règle : ces lignes-là comptent à part,
  // dans leur groupe. Les autres lignes (aucune règle spécifique) comptent
  // TOUTES ENSEMBLE — une remise globale porte sur le panier entier, pas
  // sur chaque collection séparément.
  const collectionsCiblees = new Set(actifs.filter(r => r.collectionId).map(r => r.collectionId));

  const parCollection = new Map();
  const reste = [];
  for (const l of lignes) {
    if (l.collectionId && collectionsCiblees.has(l.collectionId)) {
      if (!parCollection.has(l.collectionId)) parCollection.set(l.collectionId, []);
      parCollection.get(l.collectionId).push(l);
    } else {
      reste.push(l);
    }
  }

  let remise = remiseQuantite(reste, paliersEffectifs(remises, null));
  for (const [collectionId, groupe] of parCollection) {
    remise += remiseQuantite(groupe, paliersEffectifs(remises, collectionId));
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

/* Livraison gratuite au-delà d'un seuil.
 *
 * Le seuil se compare au montant APRÈS remises : sinon un panier ramené sous
 * le seuil par une remise garderait une livraison gratuite qu'il n'a plus
 * gagnée, ou l'inverse — un panier qui l'atteignait avant remise la perdrait
 * à tort. Un code promo peut donc faire repasser sous le seuil et faire
 * réapparaître les frais : c'est le montant réellement payé qui compte. */
export function fraisLivraison(montantApresRemises, { livraison = 0, seuilGratuit = null } = {}) {
  if (seuilGratuit != null && seuilGratuit > 0 && montantApresRemises >= seuilGratuit) return 0;
  return arrondi(livraison);
}

/** Détail complet du panier — c'est ce qui s'affiche ET ce qui est facturé. */
export function totalPanier(lignes, { paliers = [], remises = null, promo = null, livraison = 0, seuilGratuit = null } = {}) {
  const st = arrondi(sousTotal(lignes));
  // `remises` (règles brutes, avec leur collection éventuelle) prime sur
  // `paliers` (une seule liste, globale) quand on l'a — sinon on retombe sur
  // l'ancien calcul, pour les appelants qui ne connaissent que les paliers.
  const rq = remises?.length ? remiseQuantiteGroupee(lignes, remises) : remiseQuantite(lignes, paliers);
  const apresQuantite = arrondi(st - rq);
  const rp = remisePromo(apresQuantite, promo);
  const apresRemises = arrondi(apresQuantite - rp);
  const fl = fraisLivraison(apresRemises, { livraison, seuilGratuit });
  const total = arrondi(apresRemises + fl);
  return {
    sousTotal: st,
    remiseQuantite: rq,
    remisePromo: rp,
    livraison: fl,
    livraisonGratuite: fl === 0 && (livraison || 0) > 0,
    total: Math.max(0, total),
    articles: nbArticles(lignes),
  };
}

/** Prix affiché sur une fiche, formaté comme le reste du site. */
export const fmtPrix = (n) => `${Number(n || 0).toLocaleString('fr-MA', {
  minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2,
  maximumFractionDigits: 2,
})} DH`;

// 2 → "2ème", 3 → "3ème"… le seul cas particulier du français (1er) ne
// concerne jamais un palier de remise, qui commence toujours au 2ᵉ article.
export const ordinal = (n) => `${n}ème`;
