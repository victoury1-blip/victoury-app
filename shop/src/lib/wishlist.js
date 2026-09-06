/* Les favoris du visiteur — une liste de slugs de produits gardée dans le
   navigateur, comme le panier. Pas de compte client sur ce site : sans ça,
   un client qui hésite entre deux modèles n'a aucun moyen de les retrouver
   plus tard sans les racheter en mémoire. */
const CLE = 'victoury_favoris';

export function lireFavoris() {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) || '[]');
    return Array.isArray(brut) ? brut.filter(s => typeof s === 'string') : [];
  } catch { return []; }
}

function ecrireFavoris(slugs) {
  try { localStorage.setItem(CLE, JSON.stringify(slugs)); } catch { /* quota */ }
  // Les autres onglets ouverts (et le cœur dans l'en-tête) doivent voir le
  // même changement sans avoir besoin de relire le localStorage eux-mêmes.
  try { window.dispatchEvent(new CustomEvent('favoris:maj')); } catch { /* hors navigateur */ }
  return slugs;
}

export const estFavori = (slug) => lireFavoris().includes(slug);

export function basculerFavori(slug) {
  const actuels = lireFavoris();
  const suivants = actuels.includes(slug) ? actuels.filter(s => s !== slug) : [...actuels, slug];
  return ecrireFavoris(suivants);
}
