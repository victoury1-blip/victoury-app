import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { miniature, surErreurMiniature } from '../lib/img';

/* Une carte par collection, photo + nom + nombre de produits en incrustation —
   c'est la première question du client ("qu'est-ce que vous vendez ?"),
   avant même de lui montrer des produits individuels. */
function CategoriesGrid({ collections }) {
  const visibles = (collections || []).filter(c => c.count > 0);
  const pisteRef = useRef(null);
  const defiler = (sens) => {
    const piste = pisteRef.current;
    if (!piste) return;
    piste.scrollBy({ left: sens * piste.clientWidth * 0.9, behavior: 'smooth' });
  };
  if (!visibles.length) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-16">
      <h2 className="text-center text-sm tracking-[0.2em] uppercase text-gray-500">Nos catégories</h2>
      {/* Défilement horizontal (pas une grille qui retombe à la ligne) —
          même schéma que "Nos nouveautés" juste en dessous : avec un nombre
          de catégories qui ne tombe pas juste (3, 5...), une grille en
          grid-cols-2 laissait la dernière carte seule sur sa ligne, mal
          alignée sous les deux du dessus. Rien, au premier coup d'œil, ne
          disait qu'il y avait plus à voir sur le côté — des flèches
          visibles à toutes les tailles (pas seulement au clavier/souris)
          rendent ce défilement évident, en plus du glissement au doigt. */}
      <div className="relative mt-8">
        <div ref={pisteRef} className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2
                        [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visibles.map(c => {
          // Une collection "Soldes"/promo n'a en général pas de vraie photo à
          // elle (ce n'est pas un produit) — un visuel générique "clipart"
          // (étiquettes, ruban rouge...) déposé à la place détonnait à côté
          // des vraies photos de mannequin des autres catégories. Une carte
          // typographique, dans le même style sobre que le reste du site,
          // reste élégante quelle que soit l'image (ou son absence).
          const estSolde = /solde/i.test(c.slug || c.name || '');
          return (
            <Link key={c.id} to={`/product-category/${c.slug}/`}
              className="group relative aspect-[3/4] overflow-hidden bg-sand block w-[42%] sm:w-[31%] lg:w-[23%] shrink-0 snap-start">
              {/* Le nom + nombre de produits restent affichés en bas (bande
                  commune à toutes les cartes, juste en dessous) — pas
                  répétés ici. */}
              {estSolde ? (
                <div className="relative w-full h-full bg-gradient-to-br from-ink to-black grid place-items-center text-center px-4 border border-white/10">
                  {/* Lueur douce derrière le pourcentage — évite le "carré tout
                      plat" et rappelle le rouge déjà utilisé pour les remises
                      partout ailleurs sur le site (badge %, prix barré...). */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-40 h-40 rounded-full bg-red-600/20 blur-3xl" />
                  </div>
                  {/* Même style de ruban que "Meilleure vente" sur les fiches
                      produit (coin haut-gauche, dégradé ambre/rouge) — le même
                      langage visuel qu'ailleurs sur le site, pas un élément
                      inventé pour cette seule carte. */}
                  <span className="absolute top-0 left-0 bg-gradient-to-r from-amber-500 to-red-500 text-white
                                   font-bold tracking-wide uppercase shadow-sm text-[10px] px-3 py-1.5"
                    style={{ clipPath: 'polygon(0 0, 100% 0, 86% 100%, 0 100%)' }}>
                    Promo
                  </span>
                  <div className="relative">
                    <p className="text-red-500 text-4xl sm:text-5xl font-bold tracking-wide">−50%</p>
                    <div className="mx-auto mt-3 w-10 h-px bg-white/30" />
                    <p className="mt-3 text-white/70 text-xs sm:text-sm tracking-widest uppercase">Jusqu'à</p>
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
        {visibles.length > 2 && (
          <>
            <button type="button" onClick={() => defiler(-1)} aria-label="Précédent"
              className="absolute -left-2 sm:-left-4 top-[38%] -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full
                        bg-white shadow-md border border-gray-100 grid place-items-center text-ink hover:bg-gray-50">
              <ChevronLeft size={16} />
            </button>
            <button type="button" onClick={() => defiler(1)} aria-label="Suivant"
              className="absolute -right-2 sm:-right-4 top-[38%] -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full
                        bg-white shadow-md border border-gray-100 grid place-items-center text-ink hover:bg-gray-50">
              <ChevronRight size={16} />
            </button>
          </>
        )}
      </div>
    </section>
  );
}

// Sans ce memo, l'intervalle du carrousel du Hero (toutes les 3s) re-rendait
// toute la page d'accueil, y compris cette grille inchangée.
export default React.memo(CategoriesGrid);
