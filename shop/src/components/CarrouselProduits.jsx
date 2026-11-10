import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtPrix } from '../lib/pricing';
import { miniature, surErreurMiniature } from '../lib/img';

/* « Produits similaires » juste sous le bouton WhatsApp de la fiche : une
 * rangée qui défile toute seule, en continu — vers la droite en arabe, vers
 * la gauche en français (même règle que le bandeau d'annonce, voir
 * index.css). La piste contient la liste deux fois de suite : glisser
 * d'exactement une moitié rend la boucle invisible. Un doigt posé (ou la
 * souris) met en pause, pour pouvoir viser une vignette. */
export default function CarrouselProduits({ produits, ar, titre }) {
  const [pause, setPause] = useState(false);
  if (!produits || produits.length < 2) return null;
  const liste = [...produits, ...produits];
  const duree = Math.max(18, produits.length * 5);

  return (
    <div className="mt-6" dir={ar ? 'rtl' : 'ltr'}>
      <p className="text-[13px] font-semibold text-ink">{titre}</p>
      {/* dir="ltr" sur la piste : le calcul du défilement (translateX) reste
          le même dans les deux langues, seul le sens de l'animation change. */}
      <div className="mt-3 -mx-1 overflow-hidden" dir="ltr"
        onMouseEnter={() => setPause(true)} onMouseLeave={() => setPause(false)}
        onTouchStart={() => setPause(true)} onTouchEnd={() => setTimeout(() => setPause(false), 1500)}>
        <div className="flex w-max gap-3 px-1"
          style={{
            animation: `${ar ? 'annonce-defile' : 'annonce-defile-inverse'} ${duree}s linear infinite`,
            animationPlayState: pause ? 'paused' : 'running',
          }}>
          {liste.map((p, i) => {
            const image = p.images?.[0]?.url;
            const promo = p.compare_at && Number(p.compare_at) > Number(p.price);
            return (
              <Link key={`${p.id}-${i}`} to={`/product/${p.slug}/`} aria-hidden={i >= produits.length || undefined}
                tabIndex={i >= produits.length ? -1 : undefined}
                className="w-32 shrink-0 block" dir={ar ? 'rtl' : 'ltr'}>
                <span className="block w-32 h-40 rounded-lg overflow-hidden bg-sand">
                  {image && <img src={miniature(image)} onError={(e) => surErreurMiniature(e, image)} alt={p.name}
                    loading="lazy" className="w-full h-full object-cover" />}
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
    </div>
  );
}
