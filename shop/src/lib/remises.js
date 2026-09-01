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
export function paliersEffectifs(remises) {
  const actifs = (remises || []).filter(r => r.active && r.type !== 'inactive');
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
