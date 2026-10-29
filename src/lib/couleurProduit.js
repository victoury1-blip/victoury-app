/* Couleur d'affichage d'un produit dans les listes (Commandes, Colis,
 * Retours) : chaque MODÈLE a sa couleur, pour reconnaître d'un coup d'œil
 * « Ensemble Hijab Sport » d'« Ensemble Sport ». Le modèle = le nom sans le
 * mot de couleur (« Ensemble Sport Noir » et « Ensemble Sport Gris » gardent
 * la même teinte, la couleur de l'article reste écrite dans le nom).
 * Toujours la même teinte pour un même modèle : calculée depuis le nom.
 */

const MOTS_COULEUR = new Set([
  'noir', 'noire', 'blanc', 'blanche', 'gris', 'grise', 'beige', 'kaki', 'khaki', 'marron', 'camel',
  'bleu', 'bleue', 'ciel', 'marine', 'vert', 'verte', 'sauge', 'olive', 'rose', 'rouge', 'bordeaux',
  'jaune', 'orange', 'violet', 'mauve', 'lila', 'taupe', 'ecru', 'écru', 'clair', 'foncé', 'fonce',
  'nude', 'moutarde', 'turquoise', 'corail', 'sable', 'chocolat', 'anthracite',
]);

const PALETTE = [
  '#2563EB', '#DC2626', '#059669', '#7C3AED', '#D97706', '#DB2777',
  '#0891B2', '#65A30D', '#EA580C', '#4F46E5', '#0D9488', '#B45309',
];

export function modeleProduit(nom) {
  return String(nom || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[\s\-–/]+/)
    .filter(m => m && !MOTS_COULEUR.has(m))
    .join(' ')
    .trim();
}

/* Teintes choisies à la main : tout ce qui est « hijab » en vert, le reste
   des ensembles sport en noir (y compris l'orthographe « sporte » d'anciennes
   commandes). Les autres modèles gardent une teinte calculée. */
const VERT_HIJAB = '#65A30D';
const NOIR_SPORT = '#111827';

export function couleurProduit(nom) {
  const m = modeleProduit(nom);
  if (!m) return '#1F2937';
  if (/\bhijab\b/.test(m)) return VERT_HIJAB;
  if (/\bsporte?\b/.test(m)) return NOIR_SPORT;
  let h = 0;
  for (let i = 0; i < m.length; i++) h = (h * 31 + m.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
