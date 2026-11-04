/* Tailles épuisées des ensembles (bandeau en haut de l'administration).
 * Une taille à 0 s'affiche jusqu'à ce qu'on la réapprovisionne, ou qu'on la
 * marque « Manque de stock » (pas de réassort prévu) — elle revient alors
 * d'elle-même si elle est réapprovisionnée puis retombe à zéro. */

export const CLE_MANQUES = 'tailles_manque_stock';
export const cleTaille = (produitId, taille) => `${produitId}:${taille}`;

/** Produits actifs d'une collection « Ensemble… » avec au moins une taille à 0. */
export function taillesEpuisees(produits, manques = []) {
  const ignorees = new Set(manques);
  return (produits || [])
    .filter(p => p.status === 'Actif' && /ensemble/i.test(p.collection?.name || p.shop_collections?.name || ''))
    .map(p => ({
      ...p,
      epuisees: [...(p.sizes || [])]
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .filter(t => (Number(t.stock) || 0) <= 0 && !ignorees.has(cleTaille(p.id, t.size))),
    }))
    .filter(p => p.epuisees.length)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

/** Retire de la liste « manque » les tailles qui ont de nouveau du stock. */
export function nettoyerManques(produits, manques = []) {
  const enStock = new Set();
  for (const p of produits || []) for (const t of p.sizes || []) if ((Number(t.stock) || 0) > 0) enStock.add(cleTaille(p.id, t.size));
  return manques.filter(k => !enStock.has(k));
}
