import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { fmtPrix } from '../lib/pricing';
import { miniature, surErreurMiniature } from '../lib/img';

/* « Produits similaires » juste sous le bouton WhatsApp de la fiche : une
 * rangée qui défile toute seule — vers la droite en arabe, vers la gauche en
 * français — ET qu'on peut faire glisser au doigt. C'est un vrai défilement
 * horizontal (pas une animation CSS figée) : le doigt le pousse librement,
 * le défilement automatique s'arrête pendant le geste et reprend quelques
 * secondes après. La liste est mise deux fois de suite : arrivé au bout
 * d'une moitié, on saute à la même image dans l'autre moitié, sans que ça
 * se voie, donc la boucle est infinie dans les deux sens. */
const VITESSE = 30;        // pixels par seconde
const REPRISE_MS = 2500;   // pause après un geste

export default function CarrouselProduits({ produits, ar, titre }) {
  const piste = useRef(null);
  const enPause = useRef(false);
  const timerReprise = useRef(null);

  const n = produits?.length || 0;

  useEffect(() => {
    const el = piste.current;
    if (!el || n < 2) return;
    const moitie = () => el.scrollWidth / 2;
    // Boucle : on reste toujours dans [0, moitié[ (ou ]0, moitié] en arabe).
    const replier = () => {
      const m = moitie();
      if (m <= 0) return;
      if (el.scrollLeft >= m) el.scrollLeft -= m;
      else if (el.scrollLeft <= 0) el.scrollLeft += m;
    };
    if (ar) el.scrollLeft = moitie(); // en arabe on part de la fin pour aller vers la droite

    let pos = el.scrollLeft;
    let avant = performance.now();
    let raf = 0;
    const pas = (t) => {
      const dt = Math.min(64, t - avant);
      avant = t;
      if (!enPause.current && document.visibilityState === 'visible') {
        pos += (ar ? -1 : 1) * VITESSE * dt / 1000;
        el.scrollLeft = pos;
        replier();
        // scrollLeft est arrondi par le navigateur : on garde la position
        // fine à part, recalée seulement après un saut de boucle.
        if (Math.abs(el.scrollLeft - pos) > 2) pos = el.scrollLeft;
      } else {
        pos = el.scrollLeft;
      }
      raf = requestAnimationFrame(pas);
    };
    raf = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(raf);
  }, [n, ar]);

  function geste() {
    enPause.current = true;
    clearTimeout(timerReprise.current);
  }
  function finGeste() {
    clearTimeout(timerReprise.current);
    timerReprise.current = setTimeout(() => { enPause.current = false; }, REPRISE_MS);
  }
  function surScrollManuel() {
    if (!enPause.current) return;
    const el = piste.current;
    const m = el.scrollWidth / 2;
    if (el.scrollLeft >= m) el.scrollLeft -= m;
    else if (el.scrollLeft <= 0) el.scrollLeft += m;
  }
  useEffect(() => () => clearTimeout(timerReprise.current), []);

  if (n < 2) return null;
  const liste = [...produits, ...produits];

  return (
    <div className="mt-6" dir={ar ? 'rtl' : 'ltr'}>
      <p className="text-[13px] font-semibold text-ink">{titre}</p>
      {/* dir="ltr" sur la piste : scrollLeft se comporte pareil dans les deux
          langues ; seul le sens du défilement automatique change. */}
      <div ref={piste} dir="ltr"
        onTouchStart={geste} onTouchEnd={finGeste} onTouchCancel={finGeste}
        onMouseEnter={geste} onMouseLeave={finGeste}
        onWheel={() => { geste(); finGeste(); }}
        onScroll={surScrollManuel}
        className="mt-3 -mx-1 px-1 flex gap-3 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {liste.map((p, i) => {
          const image = p.images?.[0]?.url;
          const promo = p.compare_at && Number(p.compare_at) > Number(p.price);
          const double = i >= n;
          return (
            <Link key={`${p.id}-${i}`} to={`/product/${p.slug}/`} aria-hidden={double || undefined}
              tabIndex={double ? -1 : undefined} draggable={false}
              className="w-32 shrink-0 block" dir={ar ? 'rtl' : 'ltr'}>
              <span className="block w-32 h-40 rounded-lg overflow-hidden bg-sand">
                {image && <img src={miniature(image)} onError={(e) => surErreurMiniature(e, image)} alt={p.name}
                  loading="lazy" draggable={false} className="w-full h-full object-cover" />}
              </span>
              <span className="block mt-1.5 text-xs text-gray-800 truncate">{p.name}</span>
              <span className="block text-xs font-semibold text-ink">
                {fmtPrix(p.price, ar ? 'ar' : 'fr')}
                {promo && <span className="ms-1 font-normal text-[10px] text-red-500 line-through">{fmtPrix(p.compare_at, ar ? 'ar' : 'fr')}</span>}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
