import React from 'react';
import { Link } from 'react-router-dom';
import { miniature, surErreurMiniature } from '../lib/img';

/* Une carte par collection, photo + nom + nombre de produits en incrustation —
   c'est la première question du client ("qu'est-ce que vous vendez ?"),
   avant même de lui montrer des produits individuels. */
function CategoriesGrid({ collections }) {
  const visibles = (collections || []).filter(c => c.count > 0);
  if (!visibles.length) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-16">
      <h2 className="text-center text-sm tracking-[0.2em] uppercase text-gray-500">Nos catégories</h2>
      <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {visibles.map(c => {
          // Une collection "Soldes"/promo n'a en général pas de vraie photo à
          // elle (ce n'est pas un produit) — un visuel générique "clipart"
          // (étiquettes, ruban rouge...) déposé à la place détonnait à côté
          // des vraies photos de mannequin des autres catégories. Une carte
          // typographique, dans le même style sobre que le reste du site,
          // reste élégante quelle que soit l'image (ou son absence).
          const estSolde = /solde/i.test(c.slug || c.name || '');
          return (
            <Link key={c.id} to={`/product-category/${c.slug}/`} className="group relative aspect-[3/4] overflow-hidden bg-sand block">
              {/* Le nom + nombre de produits restent affichés en bas (bande
                  commune à toutes les cartes, juste en dessous) — pas
                  répétés ici. */}
              {estSolde ? (
                <div className="w-full h-full bg-gradient-to-br from-ink to-black grid place-items-center text-center px-4">
                  <div>
                    <p className="text-red-500 text-3xl sm:text-4xl font-bold tracking-wide">−50%</p>
                    <div className="mx-auto mt-2.5 w-8 h-px bg-white/30" />
                    <p className="mt-2.5 text-white/70 text-[11px] sm:text-xs tracking-widest uppercase">Jusqu'à</p>
                  </div>
                </div>
              ) : c.image_url ? (
                <img src={miniature(c.image_url)} onError={(e) => surErreurMiniature(e, c.image_url)}
                  alt={c.name} loading="lazy" decoding="async"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              ) : (
                <div className="w-full h-full grid place-items-center text-gray-300 text-xs">Photo à venir</div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent pt-10 pb-4 px-3 text-center">
                <p className="text-white text-sm font-semibold uppercase tracking-wide">{c.name}</p>
                <p className="text-white/80 text-[11px] mt-0.5">{c.count} produit{c.count > 1 ? 's' : ''}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// Sans ce memo, l'intervalle du carrousel du Hero (toutes les 3s) re-rendait
// toute la page d'accueil, y compris cette grille inchangée.
export default React.memo(CategoriesGrid);
