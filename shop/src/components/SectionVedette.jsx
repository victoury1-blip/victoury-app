import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { chargerProduitsDeCollection } from '../lib/catalog';
import CarteProduit from './CarteProduit';
import { miniatureHero, surErreurMiniature } from '../lib/img';
import { useLang } from '../lib/i18n';

/* Une collection mise en avant à mi-page — grande photo + quelques produits —
   plutôt qu'une simple carte parmi d'autres dans "Nos catégories" : le genre
   de mise en avant qu'un site de mode réserve à son lancement du moment. */
export default function SectionVedette({ config, remises }) {
  const [produits, setProduits] = useState([]);
  const { lang } = useLang();
  const droite = config?.imagePosition === 'droite';
  // Une traduction absente (titreAr/texteAr/boutonTexteAr vides) retombe sur
  // le texte français plutôt que d'afficher un bloc vide en arabe.
  const ar = lang === 'ar';
  const titre = (ar && config?.titreAr) || config?.titre;
  const texte = (ar && config?.texteAr) || config?.texte;
  const boutonTexte = (ar && config?.boutonTexteAr) || config?.boutonTexte;

  useEffect(() => {
    if (!config?.collectionSlug) { setProduits([]); return; }
    chargerProduitsDeCollection(config.collectionSlug)
      .then(({ produits }) => setProduits(produits.slice(0, 6)))
      .catch(() => setProduits([]));
  }, [config?.collectionSlug]);

  if (!config?.active || !config.image || !config.collectionSlug) return null;

  return (
    <section className="mt-16">
      {/* Côte à côte dès le mobile (pas seulement à partir de "lg") — une
          photo empilée au-dessus du texte, sur un petit écran, la reléguait
          bien plus bas que le reste de la page d'accueil. */}
      <div className={`flex ${droite ? 'flex-row-reverse' : 'flex-row'} lg:min-h-[560px]`}>
        <div className="w-1/3 sm:w-1/2 aspect-[3/4] sm:aspect-auto bg-sand overflow-hidden shrink-0">
          <img src={miniatureHero(config.image)} onError={(e) => surErreurMiniature(e, config.image)}
            alt="" loading="lazy" className="w-full h-full object-cover" />
        </div>
        <div className="w-2/3 sm:w-1/2 flex flex-col justify-center px-4 py-6 sm:px-10 lg:px-16 text-left overflow-hidden">
          {titre && <h2 className="text-lg sm:text-2xl lg:text-3xl font-semibold tracking-tight text-ink">{titre}</h2>}
          {texte && <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-gray-500 max-w-md">{texte}</p>}
          <Link to={`/product-category/${config.collectionSlug}/`}
            className="mt-3 sm:mt-5 inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-ink hover:underline">
            {boutonTexte || 'Voir la collection'} <ArrowRight size={15} />
          </Link>

          {/* Défilement horizontal (pas une grille figée) : le dernier
              produit visible est volontairement coupé à mi-largeur — ce
              cadrage lui-même invite à glisser pour voir la suite, sans
              avoir besoin d'une flèche. */}
          {produits.length > 0 && (
            <div className="mt-5 sm:mt-8 -mr-4 sm:-mr-10 lg:-mr-16 flex gap-2.5 sm:gap-3 overflow-x-auto snap-x snap-mandatory pb-1
                            [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {produits.map(p => (
                <div key={p.id} className="w-[38%] sm:w-[30%] shrink-0 snap-start">
                  <CarteProduit produit={p} remises={remises} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
