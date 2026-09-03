import React from 'react';
import { Link } from 'react-router-dom';
import { Star, ArrowRight } from 'lucide-react';
import { fmtPrix, ordinal } from '../lib/pricing';
import { paliersEffectifs } from '../lib/remises';

/* Une fiche dans une grille. Les tailles disponibles sont montrées dès la
   liste : c'est la première question du client, et la lui épargner évite
   d'ouvrir une fiche pour rien. */
export default function CarteProduit({ produit, remises, categorie }) {
  // Règles globales + celles ciblant justement la collection de CE produit —
  // une remise réglée pour une autre collection ne doit pas s'afficher ici.
  const paliers = paliersEffectifs(remises, produit.collection_id);
  const image = produit.images?.[0]?.url;
  const tailles = (produit.sizes || []).filter(s => s.stock > 0);
  const promo = produit.compare_at > produit.price;

  return (
    <Link to={`/product/${produit.slug}/`} className="group block">
      <div className="relative bg-sand aspect-[4/5] overflow-hidden rounded-xl">
        {image ? (
          <img src={image} alt={produit.images[0].alt || produit.name} loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full grid place-items-center text-gray-300 text-xs">Photo à venir</div>
        )}
        {promo && (
          <span className="absolute top-3 left-3 bg-red-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
            −{Math.round((1 - produit.price / produit.compare_at) * 100)}%
          </span>
        )}
        {/* Purement décoratif (toute la carte est déjà le lien) — un repère
            visuel "ouvrir la fiche", pas un second bouton à cliquer. */}
        <span aria-hidden className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 grid place-items-center
                                     text-ink transition-transform group-hover:translate-x-0.5">
          <ArrowRight size={15} />
        </span>
      </div>
      {/* Toujours visibles (pas seulement au survol) : au doigt, sur mobile,
          il n'y a pas de survol — les cacher derrière un hover les rendait
          invisibles pour la majorité des visiteurs. */}
      {tailles.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tailles.map(s => (
            <span key={s.size} className="text-[10px] text-gray-500 border border-gray-200 px-1.5 py-0.5">{s.size}</span>
          ))}
        </div>
      )}
      {categorie && <p className="mt-2 text-[10px] tracking-widest uppercase text-gray-400">{categorie}</p>}
      <h3 className="mt-1 text-sm text-gray-800">{produit.name}</h3>
      {/* Pas encore de vraies notes clients (les avis sont des captures
          WhatsApp, pas un système de notation) — étoiles vides plutôt
          qu'inventer une note, en attendant un vrai système d'avis. */}
      <div className="mt-1 flex gap-0.5 text-gray-200">
        {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={12} fill="currentColor" strokeWidth={0} />)}
      </div>
      <p className="mt-1 text-sm">
        {promo && <span className="mr-2 text-xs text-gray-400 line-through">{fmtPrix(produit.compare_at)}</span>}
        <span className="font-semibold">{fmtPrix(produit.price)}</span>
      </p>
      {paliers?.length > 0 && (
        <p className="mt-1 inline-flex items-center bg-red-50 text-red-600 text-[10px] font-medium px-2 py-0.5 rounded-full">
          −{paliers[0].pourcent}% dès le {ordinal(paliers[0].rang)} article
        </p>
      )}
    </Link>
  );
}
