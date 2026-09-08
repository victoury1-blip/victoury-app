import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { chargerProduitsDeCollection } from '../lib/catalog';
import CarteProduit from './CarteProduit';
import { miniatureHero, surErreurMiniature } from '../lib/img';

/* Une collection mise en avant à mi-page — grande photo + quelques produits —
   plutôt qu'une simple carte parmi d'autres dans "Nos catégories" : le genre
   de mise en avant qu'un site de mode réserve à son lancement du moment. */
export default function SectionVedette({ config, remises }) {
  const [produits, setProduits] = useState([]);
  const droite = config?.imagePosition === 'droite';

  useEffect(() => {
    if (!config?.collectionSlug) { setProduits([]); return; }
    chargerProduitsDeCollection(config.collectionSlug)
      .then(({ produits }) => setProduits(produits.slice(0, 3)))
      .catch(() => setProduits([]));
  }, [config?.collectionSlug]);

  if (!config?.active || !config.image || !config.collectionSlug) return null;

  return (
    <section className="mt-16">
      {/* Côte à côte dès le mobile (pas seulement à partir de "lg") — une
          photo empilée au-dessus du texte, sur un petit écran, la reléguait
          bien plus bas que le reste de la page d'accueil. */}
      <div className={`flex ${droite ? 'flex-row-reverse' : 'flex-row'} lg:min-h-[560px]`}>
        <div className="w-2/5 sm:w-1/2 aspect-[3/4] sm:aspect-auto bg-sand overflow-hidden shrink-0">
          <img src={miniatureHero(config.image)} onError={(e) => surErreurMiniature(e, config.image)}
            alt="" loading="lazy" className="w-full h-full object-cover" />
        </div>
        <div className="w-3/5 sm:w-1/2 flex flex-col justify-center px-4 py-6 sm:px-10 lg:px-16 text-left">
          {config.titre && <h2 className="text-lg sm:text-2xl lg:text-3xl font-semibold tracking-tight text-ink">{config.titre}</h2>}
          {config.texte && <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-gray-500 max-w-md">{config.texte}</p>}
          <Link to={`/product-category/${config.collectionSlug}/`}
            className="mt-3 sm:mt-5 inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-ink hover:underline">
            {config.boutonTexte || 'Voir la collection'} <ArrowRight size={15} />
          </Link>

          {produits.length > 0 && (
            <div className="mt-5 sm:mt-8 grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 max-w-md">
              {produits.map(p => <CarteProduit key={p.id} produit={p} remises={remises} />)}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
