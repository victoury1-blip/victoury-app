import React from 'react';
import { Link } from 'react-router-dom';
import { miniature, surErreurMiniature } from '../lib/img';

/* Une carte par collection, photo + nom + nombre de produits en incrustation —
   c'est la première question du client ("qu'est-ce que vous vendez ?"),
   avant même de lui montrer des produits individuels. */
export default function CategoriesGrid({ collections }) {
  const visibles = (collections || []).filter(c => c.count > 0);
  if (!visibles.length) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-16">
      <h2 className="text-center text-sm tracking-[0.2em] uppercase text-gray-500">Nos catégories</h2>
      <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {visibles.map(c => (
          <Link key={c.id} to={`/product-category/${c.slug}/`} className="group relative aspect-[3/4] overflow-hidden bg-sand block">
            {c.image_url ? (
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
        ))}
      </div>
    </section>
  );
}
