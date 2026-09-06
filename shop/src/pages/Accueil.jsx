import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import CarteProduit from '../components/CarteProduit';
import AvisClients from '../components/AvisClients';
import Reassurance from '../components/Reassurance';
import CategoriesGrid from '../components/CategoriesGrid';
import HeroCarrousel from '../components/HeroCarrousel';
import { chargerNouveautes, chargerAvis, chargerCollectionsAvecCompte } from '../lib/catalog';
import { useLang } from '../lib/i18n';

export default function Accueil({ collections, reglages }) {
  const { t } = useLang();
  const [produits, setProduits] = useState([]);
  const pisteRef = useRef(null);
  const defiler = (sens) => {
    const piste = pisteRef.current;
    if (!piste) return;
    piste.scrollBy({ left: sens * piste.clientWidth * 0.9, behavior: 'smooth' });
  };
  const [avis, setAvis] = useState([]);
  const [collectionsCompte, setCollectionsCompte] = useState([]);
  // Sans ce drapeau, la section entière (titre + grille) restait absente
  // (tableau vide) jusqu'à la réponse de Supabase, puis apparaissait d'un
  // coup — poussant tout ce qui suit (avis, pied de page) d'un coup sec.
  // Un squelette de la même hauteur pendant le chargement évite ce saut.
  const [chargementCategories, setChargementCategories] = useState(true);
  const [chargementNouveautes, setChargementNouveautes] = useState(true);
  useEffect(() => { chargerNouveautes(8).then(setProduits).catch(() => {}).finally(() => setChargementNouveautes(false)); }, []);
  useEffect(() => { chargerAvis().then(setAvis).catch(() => {}); }, []);
  useEffect(() => { chargerCollectionsAvecCompte().then(setCollectionsCompte).catch(() => {}).finally(() => setChargementCategories(false)); }, []);
  const hero = reglages?.theme?.hero || {};
  const sh = reglages?.theme?.texteSousHero || {};

  // Plusieurs diapositives réglées (/store/theme) : sinon, l'unique photo
  // du Hero fait office de diapositive seule.
  const diapos = (hero.slides?.length ? hero.slides : [{ imageDesktop: hero.imageDesktop, imageMobile: hero.imageMobile }])
    .filter(d => d.imageDesktop || d.imageMobile);
  const aUneImage = diapos.length > 0;

  // Retrouver la collection d'un produit par balayage de tableau à chaque
  // rendu (une fois par carte) coûtait cher sur une grande liste — une Map
  // ne se reconstruit que quand la liste de collections change vraiment.
  const collectionsParId = useMemo(() => new Map(collections.map(c => [c.id, c])), [collections]);

  return (
    <>
      <section className="relative bg-sand">
        <HeroCarrousel diapos={diapos} />
        {/* Un fond photo peut être chargé n'importe où : ce voile assombrit
            juste assez pour que le texte blanc reste lisible dessus. */}
        {aUneImage && <div className="absolute inset-0 bg-black/25" />}
        <div className="absolute inset-0 grid place-items-center text-center px-6">
          <div>
            <h1 className={`text-2xl sm:text-4xl tracking-[0.2em] uppercase ${aUneImage ? 'text-white' : 'text-ink'}`}>
              {hero.titre || 'Bienvenue chez Victoury'}
            </h1>
            <p className={`mt-3 text-sm ${aUneImage ? 'text-white/85' : 'text-gray-600'}`}>{hero.sousTitre || 'Le confort au quotidien'}</p>
            <Link to={hero.boutonLien || (collections[0] ? `/product-category/${collections[0].slug}/` : '/')}
              className={`inline-block mt-7 border px-8 py-3 text-[11px] tracking-widest uppercase transition-colors
                         ${aUneImage
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

      {chargementCategories ? (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-16">
          <div className="h-4 w-32 bg-gray-100 rounded mx-auto animate-pulse" />
          <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-[3/4] bg-gray-100 rounded animate-pulse" />)}
          </div>
        </section>
      ) : (
        <CategoriesGrid collections={collectionsCompte} />
      )}

      {chargementNouveautes ? (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-16">
          <div className="h-7 w-56 bg-gray-100 rounded mx-auto animate-pulse" />
          <div className="mt-8 flex gap-4 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-[46%] sm:w-[31%] lg:w-[23%] shrink-0 aspect-[4/5] bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        </section>
      ) : produits.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-16">
          <h2 className="text-center text-2xl sm:text-3xl font-semibold tracking-tight text-ink">{t('nosNouveautes')}</h2>
          <p className="mt-3 text-center text-sm text-gray-500 max-w-md mx-auto">{t('nosNouveautesTexte')}</p>
          <Link to={collections[0] ? `/product-category/${collections[0].slug}/` : '/'}
            className="mt-5 flex items-center justify-center gap-1.5 text-sm font-medium text-ink hover:underline">
            {t('tousLesProduits')} <ArrowRight size={15} />
          </Link>

          <div className="relative mt-8">
            <div ref={pisteRef}
              className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2
                        [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {produits.map(p => (
                <div key={p.id} className="w-[46%] sm:w-[31%] lg:w-[23%] shrink-0 snap-start">
                  <CarteProduit produit={p} remises={reglages?.remises}
                    categorie={collectionsParId.get(p.collection_id)?.name} />
                </div>
              ))}
            </div>
            {/* Flèches de défilement, comme un carrousel de rayon — le
                double-clic répété sur la molette pour voir tout le reste
                de la nouvelle collection n'était pas évident sur bureau. */}
            {produits.length > 2 && (
              <>
                <button type="button" onClick={() => defiler(-1)} aria-label="Précédent"
                  className="hidden sm:grid absolute -left-4 top-1/3 -translate-y-1/2 w-10 h-10 rounded-full
                            bg-white shadow-md border border-gray-100 place-items-center text-ink hover:bg-gray-50">
                  <ChevronLeft size={18} />
                </button>
                <button type="button" onClick={() => defiler(1)} aria-label="Suivant"
                  className="hidden sm:grid absolute -right-4 top-1/3 -translate-y-1/2 w-10 h-10 rounded-full
                            bg-white shadow-md border border-gray-100 place-items-center text-ink hover:bg-gray-50">
                  <ChevronRight size={18} />
                </button>
              </>
            )}
          </div>
        </section>
      )}

      <Reassurance items={reglages?.theme?.reassurance} active={reglages?.theme?.reassuranceActive} />

      <AvisClients avis={avis} />
    </>
  );
}
