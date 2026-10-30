/* Groupe d'un produit pour le coût d'achat : le modèle sans la couleur
 * (« Ensemble Sport Noir » et « Ensemble Sporte Marron » → « ensemble sport »,
 * « Ensemble Hijab Vert sauge » et « Ensemble Hijab Sport gris » →
 * « ensemble hijab sport »). Un même groupe partage en général un même prix
 * d'achat, qu'on saisit alors en une fois. */
import { modeleProduit } from './couleurProduit';

export function groupeProduit(nom) {
  const m = modeleProduit(nom).replace(/\bsporte\b/g, 'sport');
  if (/\bhijab\b/.test(m)) return 'ensemble hijab sport';
  return m || 'autre';
}

/** « ensemble hijab sport » → « Ensemble Hijab Sport ». */
export const libelleGroupe = (g) => String(g || '').replace(/\b\p{L}/gu, (c) => c.toUpperCase());
