import React, { useEffect, useRef, useState } from 'react';
import { miniature, surErreurMiniature } from '../lib/img';

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

  // Avec 5-6 diapositives réglées (/store/theme), toutes les monter dès le
  // premier rendu téléchargeait leurs 6 photos d'un coup au chargement de la
  // page — l'essentiel du poids d'images relevé par PageSpeed. Une diapo
  // n'est montée (et donc téléchargée) qu'une fois "atteinte" par le
  // défilement, puis reste montée pour ne pas la re-télécharger au prochain
  // passage — l'intervalle de 3s laisse largement le temps à sa miniature
  // de précharger avant qu'elle ne doive s'afficher.
  // La suivante est montée un cran à l'avance (pas seulement la courante) :
  // sinon, la toute première fois qu'elle doit s'afficher, elle serait
  // encore en train de télécharger — un flash vide le temps qu'elle arrive.
  const maxAtteintRef = useRef(0);
  const prochaine = Math.min(indice + 1, diapos.length - 1);
  maxAtteintRef.current = Math.max(maxAtteintRef.current, indice, prochaine);

  const aUneImage = diapos.length > 0;

  return (
    <div className="aspect-[16/10] sm:aspect-[16/7] overflow-hidden relative">
      {aUneImage ? diapos.map((d, i) => (
        i > maxAtteintRef.current ? null :
        // Chaque diapositive reste montée et s'estompe en place : pas de
        // saut ni de rechargement d'image au changement.
        <picture key={i} className={`absolute inset-0 transition-opacity duration-700 ${i === indice ? 'opacity-100' : 'opacity-0'}`}>
          {/* Que l'admin ait réglé une photo mobile séparée ou non, le mobile
              n'a jamais besoin de plus que la miniature 500px déjà générée à
              l'envoi (voir admin.js) — une "Image Mobile" déposée sans y
              penser reste souvent, en pratique, la même pleine résolution
              que la version desktop (jusqu'à 1600px sur un écran ~390px). */}
          <source media="(max-width: 640px)" srcSet={miniature(d.imageMobile || d.imageDesktop)} />
          {/* Une diapositive tout juste déposée (pas encore passée par
              "Régénérer les miniatures pour le web") n'a pas encore de
              fichier "-thumb" — sans ce filet, l'image choisie via <source>
              échouait tout simplement (une <picture> ne retente jamais
              d'elle-même le src de secours de l'<img>) et n'affichait rien
              du tout plutôt que l'originale en pleine résolution. */}
          <img src={d.imageDesktop || d.imageMobile} alt="" fetchpriority={i === 0 ? 'high' : undefined}
            loading={i === 0 ? 'eager' : 'lazy'} className="w-full h-full object-cover"
            onError={(e) => surErreurMiniature(e, d.imageDesktop || d.imageMobile)} />
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
