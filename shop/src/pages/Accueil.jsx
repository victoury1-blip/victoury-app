import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CarteProduit from '../components/CarteProduit';
import { chargerNouveautes } from '../lib/catalog';

export default function Accueil({ collections, reglages }) {
  const [produits, setProduits] = useState([]);
  useEffect(() => { chargerNouveautes(8).then(setProduits).catch(() => {}); }, []);
  const hero = reglages?.theme?.hero || {};
  const sh = reglages?.theme?.texteSousHero || {};

  return (
    <>
      <section className="relative bg-sand">
        <div className="aspect-[16/10] sm:aspect-[16/7] overflow-hidden">
          {(hero.imageDesktop || hero.imageMobile) ? (
            // Image mobile dédiée si réglée, sinon la même que le bureau.
            <picture>
              {hero.imageMobile && <source media="(max-width: 640px)" srcSet={hero.imageMobile} />}
              <img src={hero.imageDesktop || hero.imageMobile} alt="" className="w-full h-full object-cover" />
            </picture>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-sand to-gray-200" />
          )}
        </div>
        {/* Un fond photo peut être chargé n'importe où : ce voile assombrit
            juste assez pour que le texte blanc reste lisible dessus. */}
        {(hero.imageDesktop || hero.imageMobile) && <div className="absolute inset-0 bg-black/25" />}
        <div className="absolute inset-0 grid place-items-center text-center px-6">
          <div>
            <h1 className={`text-2xl sm:text-4xl tracking-[0.2em] uppercase ${(hero.imageDesktop || hero.imageMobile) ? 'text-white' : 'text-ink'}`}>
              {hero.titre || 'Bienvenue chez Victoury'}
            </h1>
            <p className={`mt-3 text-sm ${(hero.imageDesktop || hero.imageMobile) ? 'text-white/85' : 'text-gray-600'}`}>{hero.sousTitre || 'Le confort au quotidien'}</p>
            <Link to={hero.boutonLien || (collections[0] ? `/product-category/${collections[0].slug}/` : '/')}
              className={`inline-block mt-7 border px-8 py-3 text-[11px] tracking-widest uppercase transition-colors
                         ${(hero.imageDesktop || hero.imageMobile)
                            ? 'border-white text-white hover:bg-white hover:text-ink'
                            : 'border-ink hover:bg-ink hover:text-white'}`}>
              {hero.boutonTexte || 'Voir la collection'} →
            </Link>
          </div>
        </div>
      </section>

      {sh.texte && (
        <p className="text-center px-6 py-6" style={{ fontSize: `${sh.taille || 14}px`, color: sh.couleurTexte, background: sh.couleurFond }}>
          {sh.texte}
        </p>
      )}

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
