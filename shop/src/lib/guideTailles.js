/* Guide des tailles — vêtements de sport femme en tissu élastique.
 * Grille standard (comme la plupart des marques de sport) : S → 3XL.
 * Le tissu s'étire, donc chaque taille couvre une plage assez large ;
 * la suggestion se fait surtout au poids, la taille (hauteur) ne sert qu'à
 * départager quand on est en haut d'une plage. */

export const GRILLE_TAILLES = [
  { taille: 'S',   poids: [40, 54], hauteur: [150, 160] },
  { taille: 'M',   poids: [54, 62], hauteur: [155, 165] },
  { taille: 'L',   poids: [62, 70], hauteur: [158, 168] },
  { taille: 'XL',  poids: [70, 78], hauteur: [160, 170] },
  { taille: '2XL', poids: [78, 87], hauteur: [160, 172] },
  { taille: '3XL', poids: [87, 98], hauteur: [160, 175] },
];

const MESURES = ['poids', 'hauteur'];

/** '40-54' / '40 – 54' → [40, 54] ; null si illisible. */
export function lirePlage(txt) {
  const m = /(\d+(?:[.,]\d+)?)\s*[-–—à]\s*(\d+(?:[.,]\d+)?)/.exec(String(txt ?? ''));
  if (!m) return null;
  const a = Number(m[1].replace(',', '.')), b = Number(m[2].replace(',', '.'));
  return a <= b ? [a, b] : [b, a];
}

/** Grille réglée dans /store/theme si elle est utilisable, sinon la grille standard. */
export function grilleEffective(grille) {
  if (!Array.isArray(grille)) return GRILLE_TAILLES;
  // Chaque mesure peut être [min, max] ou le texte tapé dans l'admin ("40-54").
  const plage = (v) => (Array.isArray(v) && v.length === 2 && v.every(Number.isFinite) ? v : lirePlage(v));
  const ok = grille
    .map(g => g && ({
      taille: normaliserTaille(g.taille),
      ...Object.fromEntries(MESURES.map(k => [k, plage(g[k])])),
    }))
    .filter(g => g && g.taille && g.poids);
  return ok.length ? ok.sort((a, b) => a.poids[0] - b.poids[0]) : GRILLE_TAILLES;
}

/** Grille sous forme de texte, pour l'éditer dans /store/theme. */
export function grilleEnTexte(grille) {
  const txt = (v) => (Array.isArray(v) ? `${v[0]}-${v[1]}` : String(v ?? ''));
  return (Array.isArray(grille) ? grille : GRILLE_TAILLES)
    .map(g => ({ taille: g.taille || '', ...Object.fromEntries(MESURES.map(k => [k, txt(g[k])])) }));
}

/** 'xxl' / 'XXL' / '2xl' → '2XL', 'XXXL' → '3XL' ; le reste en majuscules. */
export function normaliserTaille(t) {
  const s = String(t || '').trim().toUpperCase().replace(/\s+/g, '');
  if (s === 'XXL') return '2XL';
  if (s === 'XXXL') return '3XL';
  return s;
}

/** Le guide n'a de sens que si le produit utilise cette grille (S…3XL). */
export function produitAvecGrille(tailles, grille = GRILLE_TAILLES) {
  const connues = new Set(grilleEffective(grille).map(g => g.taille));
  return (tailles || []).some(s => connues.has(normaliserTaille(s?.size ?? s)));
}

/**
 * Suggestion à partir du poids (kg) et de la taille (cm).
 * Renvoie { taille, index, bord } ou null si les valeurs sont absurdes.
 * `bord` = vrai quand on est tout en haut de la plage : la taille au-dessus
 * peut aussi convenir à celle qui aime porter plus ample.
 */
export function suggererTaille(poids, hauteur, grilleBrute = GRILLE_TAILLES) {
  const GRILLE = grilleEffective(grilleBrute);
  const p = Number(poids);
  const h = Number(hauteur);
  if (!Number.isFinite(p) || p < 30 || p > 160) return null;
  let i = GRILLE.findIndex(g => p < g.poids[1]);
  if (i === -1) i = GRILLE.length - 1;
  const [min, max] = GRILLE[i].poids;
  const hautDePlage = p >= min + (max - min) * 0.7;
  // Plus grande que la plage de hauteur de cette taille (ou ≥ 170 cm en
  // haut de plage de poids) : le tissu tire en longueur, la taille au-dessus
  // tombe mieux.
  const tropGrande = Number.isFinite(h) && h > 0 && (
    (GRILLE[i].hauteur && h > GRILLE[i].hauteur[1]) || (h >= 170 && hautDePlage));
  if (tropGrande && i < GRILLE.length - 1) i += 1;
  const bord = hautDePlage && i < GRILLE.length - 1;
  return { taille: GRILLE[i].taille, index: i, bord };
}

/** Retrouve, parmi les tailles du produit, celle qui correspond (XXL ↔ 2XL…). */
export function tailleProduitCorrespondante(tailles, suggestion) {
  if (!suggestion) return null;
  return (tailles || []).find(s => normaliserTaille(s?.size) === suggestion)?.size ?? null;
}
