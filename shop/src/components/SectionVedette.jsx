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
      <div className={`flex flex-col ${droite ? 'lg:flex-row-reverse' : 'lg:flex-row'}`}>
        <div className="lg:w-1/2 aspect-[4/3] lg:aspect-auto bg-sand overflow-hidden">
          <img src={miniatureHero(config.image)} onError={(e) => surErreurMiniature(e, config.image)}
            alt="" loading="lazy" className="w-full h-full object-cover" />
        </div>
        <div className="lg:w-1/2 flex flex-col justify-center px-6 py-10 lg:px-16 text-center lg:text-left">
          {config.titre && <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink">{config.titre}</h2>}
          {config.texte && <p className="mt-3 text-sm text-gray-500 max-w-md mx-auto lg:mx-0">{config.texte}</p>}
          <Link to={`/product-category/${config.collectionSlug}/`}
            className="mt-5 inline-flex items-center justify-center lg:justify-start gap-1.5 text-sm font-medium text-ink hover:underline">
            {config.boutonTexte || 'Voir la collection'} <ArrowRight size={15} />
          </Link>

          {produits.length > 0 && (
            <div className="mt-8 grid grid-cols-3 gap-3 max-w-md mx-auto lg:mx-0">
              {produits.map(p => <CarteProduit key={p.id} produit={p} remises={remises} />)}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
