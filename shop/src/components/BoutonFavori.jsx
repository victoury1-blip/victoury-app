import React, { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { estFavori, basculerFavori } from '../lib/wishlist';

/* Cœur cliquable, réutilisé sur la carte grille et sur la fiche produit —
   même geste, mêmes règles de lecture/écriture du localStorage, partout. */
export default function BoutonFavori({ slug, className = '' }) {
  const [actif, setActif] = useState(() => estFavori(slug));

  // Le même produit peut être basculé depuis un autre onglet, ou depuis la
  // carte grille pendant que la fiche produit du même article est ouverte
  // ailleurs sur l'écran (deux composants pour le même slug).
  useEffect(() => {
    const relire = () => setActif(estFavori(slug));
    relire();
    window.addEventListener('favoris:maj', relire);
    return () => window.removeEventListener('favoris:maj', relire);
  }, [slug]);

  return (
    <button type="button" aria-label={actif ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      aria-pressed={actif}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); basculerFavori(slug); }}
      className={className}>
      <Heart size={16} className={actif ? 'fill-red-500 text-red-500' : 'text-gray-500'} />
    </button>
  );
}
