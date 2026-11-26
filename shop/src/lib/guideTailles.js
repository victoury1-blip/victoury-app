/* Guide des tailles — vêtements de sport femme en tissu élastique.
 * Grille standard (comme la plupart des marques de sport) : S → 3XL.
 * Le tissu s'étire, donc chaque taille couvre une plage assez large ;
 * la suggestion se fait surtout au poids, la taille (hauteur) ne sert qu'à
 * départager quand on est en haut d'une plage. */

export const GRILLE_TAILLES = [
  { taille: 'S',   poids: [40, 54],  poitrine: [80, 86],   tourTaille: [62, 68],  hanches: [86, 92] },
  { taille: 'M',   poids: [54, 62],  poitrine: [86, 92],   tourTaille: [68, 74],  hanches: [92, 98] },
  { taille: 'L',   poids: [62, 70],  poitrine: [92, 98],   tourTaille: [74, 80],  hanches: [98, 104] },
  { taille: 'XL',  poids: [70, 78],  poitrine: [98, 104],  tourTaille: [80, 86],  hanches: [104, 110] },
  { taille: '2XL', poids: [78, 87],  poitrine: [104, 110], tourTaille: [86, 92],  hanches: [110, 116] },
  { taille: '3XL', poids: [87, 98],  poitrine: [110, 118], tourTaille: [92, 100], hanches: [116, 124] },
];

/** 'xxl' / 'XXL' / '2xl' → '2XL', 'XXXL' → '3XL' ; le reste en majuscules. */
export function normaliserTaille(t) {
  const s = String(t || '').trim().toUpperCase().replace(/\s+/g, '');
  if (s === 'XXL') return '2XL';
  if (s === 'XXXL') return '3XL';
  return s;
}

/** Le guide n'a de sens que si le produit utilise cette grille (S…3XL). */
export function produitAvecGrille(tailles) {
  const connues = new Set(GRILLE_TAILLES.map(g => g.taille));
  return (tailles || []).some(s => connues.has(normaliserTaille(s?.size ?? s)));
}

/**
 * Suggestion à partir du poids (kg) et de la taille (cm).
 * Renvoie { taille, index, bord } ou null si les valeurs sont absurdes.
 * `bord` = vrai quand on est tout en haut de la plage : la taille au-dessus
 * peut aussi convenir à celle qui aime porter plus ample.
 */
export function suggererTaille(poids, hauteur) {
  const p = Number(poids);
  const h = Number(hauteur);
  if (!Number.isFinite(p) || p < 30 || p > 160) return null;
  let i = GRILLE_TAILLES.findIndex(g => p < g.poids[1]);
  if (i === -1) i = GRILLE_TAILLES.length - 1;
  const [min, max] = GRILLE_TAILLES[i].poids;
  const hautDePlage = p >= min + (max - min) * 0.7;
  // Grande (≥ 170 cm) et en haut de sa plage : le tissu tire en longueur,
  // la taille au-dessus tombe mieux.
  if (Number.isFinite(h) && h >= 170 && hautDePlage && i < GRILLE_TAILLES.length - 1) i += 1;
  const bord = hautDePlage && i < GRILLE_TAILLES.length - 1;
  return { taille: GRILLE_TAILLES[i].taille, index: i, bord };
}

/** Retrouve, parmi les tailles du produit, celle qui correspond (XXL ↔ 2XL…). */
export function tailleProduitCorrespondante(tailles, suggestion) {
  if (!suggestion) return null;
  return (tailles || []).find(s => normaliserTaille(s?.size) === suggestion)?.size ?? null;
}
