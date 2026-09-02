import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CarteProduit from '../components/CarteProduit';
import AvisClients from '../components/AvisClients';
import Reassurance from '../components/Reassurance';
import { chargerNouveautes, chargerAvis } from '../lib/catalog';

export default function Accueil({ collections, reglages }) {
  const [produits, setProduits] = useState([]);
  const [avis, setAvis] = useState([]);
  useEffect(() => { chargerNouveautes(8).then(setProduits).catch(() => {}); }, []);
  useEffect(() => { chargerAvis().then(setAvis).catch(() => {}); }, []);
  const hero = reglages?.theme?.hero || {};
  const sh = reglages?.theme?.texteSousHero || {};

  // Plusieurs diapositives réglées (/store/theme) : sinon, l'unique photo
  // du Hero fait office de diapositive seule.
  const diapos = (hero.slides?.length ? hero.slides : [{ imageDesktop: hero.imageDesktop, imageMobile: hero.imageMobile }])
    .filter(d => d.imageDesktop || d.imageMobile);
  const [indice, setIndice] = useState(0);
  useEffect(() => {
    setIndice(0);
    if (diapos.length < 2) return;
    const id = setInterval(() => setIndice(i => (i + 1) % diapos.length), 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diapos.length]);
  const aUneImage = diapos.length > 0;

  return (
    <>
      <section className="relative bg-sand">
        <div className="aspect-[16/10] sm:aspect-[16/7] overflow-hidden relative">
          {aUneImage ? diapos.map((d, i) => (
            // Chaque diapositive reste montée et s'estompe en place : pas de
            // saut ni de rechargement d'image au changement.
            <picture key={i} className={`absolute inset-0 transition-opacity duration-700 ${i === indice ? 'opacity-100' : 'opacity-0'}`}>
              {d.imageMobile && <source media="(max-width: 640px)" srcSet={d.imageMobile} />}
              <img src={d.imageDesktop || d.imageMobile} alt="" className="w-full h-full object-cover" />
            </picture>
          )) : (
            <div className="w-full h-full bg-gradient-to-br from-sand to-gray-200" />
          )}
          {diapos.length > 1 && (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
              {diapos.map((_, i) => (
                <button key={i} type="button" aria-label={`Diapositive ${i + 1}`} onClick={() => setIndice(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${i === indice ? 'bg-white' : 'bg-white/40'}`} />
              ))}
            </div>
          )}
        </div>
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

      <Reassurance items={reglages?.theme?.reassurance} active={reglages?.theme?.reassuranceActive} />

      {sh.texte && (
        <p className="text-center px-6 py-6" style={{ fontSize: `${sh.taille || 14}px`, color: sh.couleurTexte, background: sh.couleurFond }}>
          {sh.texte}
        </p>
      )}

      {produits.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-16">
          <h2 className="text-center text-sm tracking-[0.2em] uppercase text-gray-500">Nos nouveautés</h2>
          <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10">
            {produits.map(p => <CarteProduit key={p.id} produit={p} paliers={reglages?.paliers} />)}
          </div>
        </section>
      )}

      <AvisClients avis={avis} />
    </>
  );
}
