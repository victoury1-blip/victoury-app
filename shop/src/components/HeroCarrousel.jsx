import React, { useEffect, useState } from 'react';
import { miniature } from '../lib/img';

// Isolé d'Accueil.jsx : l'intervalle de défilement (toutes les 3s) ne doit
// re-rendre que ce carrousel, pas toute la page d'accueil (grilles de
// produits, catégories, avis) — c'était l'une des plus grosses causes du
// temps de blocage total (TBT) de la page.
export default function HeroCarrousel({ diapos }) {
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
    <div className="aspect-[16/10] sm:aspect-[16/7] overflow-hidden relative">
      {aUneImage ? diapos.map((d, i) => (
        // Chaque diapositive reste montée et s'estompe en place : pas de
        // saut ni de rechargement d'image au changement.
        <picture key={i} className={`absolute inset-0 transition-opacity duration-700 ${i === indice ? 'opacity-100' : 'opacity-0'}`}>
          {/* Que l'admin ait réglé une photo mobile séparée ou non, le mobile
              n'a jamais besoin de plus que la miniature 500px déjà générée à
              l'envoi (voir admin.js) — une "Image Mobile" déposée sans y
              penser reste souvent, en pratique, la même pleine résolution
              que la version desktop (jusqu'à 1600px sur un écran ~390px). */}
          <source media="(max-width: 640px)" srcSet={miniature(d.imageMobile || d.imageDesktop)} />
          {/* Première photo vue par chaque visiteur : priorité haute et jamais
              différée (contrairement aux grilles de produits plus bas), pour
              qu'elle n'attende pas derrière des ressources moins importantes. */}
          <img src={d.imageDesktop || d.imageMobile} alt="" fetchpriority={i === 0 ? 'high' : undefined}
            loading={i === 0 ? 'eager' : 'lazy'} className="w-full h-full object-cover" />
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
  );
}
