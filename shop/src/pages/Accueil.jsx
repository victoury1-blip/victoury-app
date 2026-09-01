import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CarteProduit from '../components/CarteProduit';
import { chargerNouveautes } from '../lib/catalog';

export default function Accueil({ collections, reglages }) {
  const [produits, setProduits] = useState([]);
  useEffect(() => { chargerNouveautes(8).then(setProduits).catch(() => {}); }, []);
  const hero = reglages?.hero || {};

  return (
    <>
      <section className="relative bg-sand">
        <div className="aspect-[16/10] sm:aspect-[16/7] overflow-hidden">
          {hero.image
            ? <img src={hero.image} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-gradient-to-br from-sand to-gray-200" />}
        </div>
        <div className="absolute inset-0 grid place-items-center text-center px-6">
          <div>
            <h1 className="text-2xl sm:text-4xl tracking-[0.2em] uppercase text-ink">
              {hero.titre || 'Bienvenue chez Victoury'}
            </h1>
            <p className="mt-3 text-sm text-gray-600">{hero.sousTitre || 'Le confort au quotidien'}</p>
            <Link to={hero.lien || (collections[0] ? `/product-category/${collections[0].slug}/` : '/')}
              className="inline-block mt-7 border border-ink px-8 py-3 text-[11px] tracking-widest uppercase
                         hover:bg-ink hover:text-white transition-colors">
              Voir la collection →
            </Link>
          </div>
        </div>
      </section>

      {produits.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-16">
          <h2 className="text-center text-sm tracking-[0.2em] uppercase text-gray-500">Nos nouveautés</h2>
          <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10">
            {produits.map(p => <CarteProduit key={p.id} produit={p} />)}
          </div>
        </section>
      )}
    </>
  );
}
