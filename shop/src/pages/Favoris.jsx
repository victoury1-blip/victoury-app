import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { lireFavoris } from '../lib/wishlist';
import { chargerProduitsParSlugs } from '../lib/catalog';
import CarteProduit from '../components/CarteProduit';
import { useLang } from '../lib/i18n';

/* Les favoris n'ont pas besoin de compte client : ils vivent dans le
   navigateur (lib/wishlist.js), au même titre que le panier — cette page ne
   fait que les rassembler et les recharger avec des données à jour. */
export default function Favoris({ remises }) {
  const { t } = useLang();
  const [produits, setProduits] = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    function recharger() {
      const slugs = lireFavoris();
      if (!slugs.length) { setProduits([]); setChargement(false); return; }
      chargerProduitsParSlugs(slugs).then(setProduits).catch(() => setProduits([])).finally(() => setChargement(false));
    }
    recharger();
    window.addEventListener('favoris:maj', recharger);
    return () => window.removeEventListener('favoris:maj', recharger);
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-xl tracking-wide flex items-center gap-2">
        <Heart size={20} className="text-red-500 fill-red-500" /> {t('mesFavoris')}
      </h1>

      {chargement ? (
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-[4/5] bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : produits.length === 0 ? (
        <div className="mt-10 text-center text-sm text-gray-400">
          <p>{t('aucunFavori')}</p>
          <Link to="/" className="mt-4 inline-block border border-ink px-6 py-2.5 text-xs tracking-widest uppercase hover:bg-ink hover:text-white transition-colors">
            {t('voirLaBoutique')}
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10">
          {produits.map(p => <CarteProduit key={p.id} produit={p} remises={remises} />)}
        </div>
      )}
    </div>
  );
}
