/* Remises par quantité — plusieurs règles nommées, une seule à la fois active
 * en pratique la plupart du temps, mais rien n'empêche d'en garder plusieurs
 * prêtes (saison, collection) et de ne basculer que l'interrupteur.
 *
 * Ce que paie le client ne doit dépendre que des règles ACTIVES : une règle
 * désactivée ne doit avoir aucun effet, même si elle reste dans la liste.
 * Quand deux règles actives couvrent le même rang (2ᵉ article, 3ᵉ…), c'est la
 * remise la plus avantageuse pour le client qui s'applique — jamais la somme
 * des deux, qui donnerait un rabais plus fort que ce qui a été annoncé.
 */
// Une règle peut être limitée à une collection (rang, cible, ex. "Ensemble
// Sport") ; sans collectionId, elle s'applique à tout le catalogue. Pour la
// fiche d'un produit donné, seules les règles globales et celles ciblant sa
// propre collection comptent — pas celles réglées pour une autre collection.
export function paliersEffectifs(remises, collectionId = null) {
  const actifs = (remises || []).filter(r =>
    r.active && r.type !== 'inactive' && (!r.collectionId || r.collectionId === collectionId));
  const parRang = new Map();
  for (const r of actifs) {
    for (const p of (r.paliers || [])) {
      const rang = Number(p.rang);
      const pourcent = Number(p.pourcent) || 0;
      if (!rang || rang < 2) continue;
      if (!parRang.has(rang) || parRang.get(rang) < pourcent) parRang.set(rang, pourcent);
    }
  }
  return [...parRang.entries()].map(([rang, pourcent]) => ({ rang, pourcent })).sort((a, b) => a.rang - b.rang);
}

/* Le palier le plus proche pas encore atteint, tous groupes du panier
 * confondus (chaque collection ciblée compte ses propres unités séparément,
 * comme lignesAvecRemise) — pour pousser "encore 1 article et -20%" au bon
 * moment plutôt que de laisser deviner le client. */
export function prochainPalier(lignes, remises) {
  if (!remises?.length || !lignes?.length) return null;
  const actifs = remises.filter(r => r.active && r.type !== 'inactive');
  const collectionsCiblees = new Set(actifs.filter(r => r.collectionId).map(r => r.collectionId));
  const quantitesParGroupe = new Map();
  for (const l of lignes) {
    const cle = l.collectionId && collectionsCiblees.has(l.collectionId) ? l.collectionId : '';
    quantitesParGroupe.set(cle, (quantitesParGroupe.get(cle) || 0) + (l.qty || 0));
  }
  let meilleur = null;
  for (const [cle, qte] of quantitesParGroupe) {
    const suivant = paliersEffectifs(remises, cle || null).find(p => p.rang > qte);
    if (suivant && (!meilleur || suivant.rang - qte < meilleur.manque)) {
      meilleur = { manque: suivant.rang - qte, rang: suivant.rang, pourcent: suivant.pourcent };
    }
  }
  return meilleur;
}
