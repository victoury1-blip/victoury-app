import React from 'react';
import { Link } from 'react-router-dom';
import { fmtPrix } from '../lib/pricing';

/* Une fiche dans une grille. Les tailles disponibles sont montrées dès la
   liste : c'est la première question du client, et la lui épargner évite
   d'ouvrir une fiche pour rien. */
export default function CarteProduit({ produit }) {
  const image = produit.images?.[0]?.url;
  const tailles = (produit.sizes || []).filter(s => s.stock > 0);
  const promo = produit.compare_at > produit.price;

  return (
    <Link to={`/product/${produit.slug}/`} className="group block">
      <div className="relative bg-sand aspect-[4/5] overflow-hidden">
        {image ? (
          <img src={image} alt={produit.images[0].alt || produit.name} loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full grid place-items-center text-gray-300 text-xs">Photo à venir</div>
        )}
        {promo && (
          <span className="absolute top-3 left-3 bg-ink text-white text-[10px] px-2 py-1 tracking-wide">
            −{Math.round((1 - produit.price / produit.compare_at) * 100)}%
          </span>
        )}
        {tailles.length > 0 && (
          <div className="absolute inset-x-0 bottom-0 bg-white/95 px-2 py-1.5 flex flex-wrap gap-1
                          opacity-0 group-hover:opacity-100 transition-opacity">
            {tailles.map(s => (
              <span key={s.size} className="text-[10px] text-gray-600 border border-gray-200 px-1.5 py-0.5">{s.size}</span>
            ))}
          </div>
        )}
      </div>
      <h3 className="mt-3 text-sm text-gray-800">{produit.name}</h3>
      <p className="mt-0.5 text-sm">
        <span className="font-medium">{fmtPrix(produit.price)}</span>
        {promo && <span className="ml-2 text-xs text-gray-400 line-through">{fmtPrix(produit.compare_at)}</span>}
      </p>
    </Link>
  );
}
