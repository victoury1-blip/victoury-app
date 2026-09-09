import React from 'react';
import { Link } from 'react-router-dom';
import { fmtPrix } from '../lib/pricing';
import { paliersEffectifs } from '../lib/remises';
import { useLang } from '../lib/i18n';
import { miniature, surErreurMiniature } from '../lib/img';
import BoutonFavori from './BoutonFavori';
import { ResumeAvis } from './AvisProduit';

/* Une fiche dans une grille. Les tailles disponibles sont montrées dès la
   liste : c'est la première question du client, et la lui épargner évite
   d'ouvrir une fiche pour rien. */
function CarteProduit({ produit, remises, categorie, compact }) {
  const { t, remisePalier } = useLang();
  // Règles globales + celles ciblant justement la collection de CE produit —
  // une remise réglée pour une autre collection ne doit pas s'afficher ici.
  const paliers = paliersEffectifs(remises, produit.collection_id);
  const image = produit.images?.[0]?.url;
  const tailles = (produit.sizes || []).filter(s => s.stock > 0);
  const promo = produit.compare_at > produit.price;

  return (
    <Link to={`/product/${produit.slug}/`} className="group block">
      <div className="relative bg-sand aspect-[4/5] overflow-hidden rounded-xl">
        {image ? (
          <img src={miniature(image)} onError={(e) => surErreurMiniature(e, image)}
            alt={produit.images[0].alt || produit.name} loading="lazy" decoding="async"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full grid place-items-center text-gray-300 text-xs">{t('photoAVenir')}</div>
        )}
        {/* Fanion collé au coin (pas un pill flottant à distance) et dégradé
            orange/rouge — le style "ruban" qu'on voit sur Temu/AliExpress
            pour ce genre de badge, plus voyant qu'une étiquette plate grise. */}
        {produit.is_bestseller && (
          <span className={`absolute top-0 left-0 bg-gradient-to-r from-amber-500 to-red-500 text-white
                           font-bold tracking-wide uppercase shadow-sm ${compact ? 'text-[7px] px-1.5 py-1' : 'text-[10px] px-3 py-1.5'}`}
            style={{ clipPath: 'polygon(0 0, 100% 0, 86% 100%, 0 100%)' }}>
            {t('meilleureVente')}
          </span>
        )}
        {promo && (
          <span className={`absolute bg-red-600 text-white font-semibold rounded-full
                            ${compact ? 'left-1.5 text-[9px] px-1.5 py-0.5' : 'left-3 text-xs px-2.5 py-1'}
                            ${produit.is_bestseller ? (compact ? 'top-6' : 'top-10') : (compact ? 'top-1.5' : 'top-3')}`}>
            −{Math.round((1 - produit.price / produit.compare_at) * 100)}%
          </span>
        )}
        <BoutonFavori slug={produit.slug}
          className={`absolute rounded-full bg-white/90 grid place-items-center hover:bg-white ${compact ? 'top-1.5 right-1.5 w-6 h-6 [&_svg]:w-3 [&_svg]:h-3' : 'top-3 right-3 w-8 h-8'}`} />
      </div>
      {/* Toujours visibles (pas seulement au survol) : au doigt, sur mobile,
          il n'y a pas de survol — les cacher derrière un hover les rendait
          invisibles pour la majorité des visiteurs. Masquées en mode compact
          (carrousel étroit de la section vedette) : une carte deux fois plus
          petite qu'une carte de grille normale n'a pas la place pour tout
          montrer sans devenir illisible. */}
      {!compact && tailles.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tailles.map(s => (
            <span key={s.size} className="text-[10px] text-gray-500 border border-gray-200 px-1.5 py-0.5">{s.size}</span>
          ))}
        </div>
      )}
      {categorie && <p className="mt-2 text-[10px] tracking-widest uppercase text-gray-400">{categorie}</p>}
      <h3 className="mt-1 text-sm text-gray-800 truncate">{produit.name}</h3>
      {/* Vraie moyenne (shop_reviews) — absente tant qu'aucun avis n'est
          approuvé pour ce produit, jamais une note inventée. Hauteur
          réservée : la moyenne arrive après coup (requête Supabase), sans
          cette réserve elle décale tout ce qui suit d'un cran à chaque
          carte de la grille dès qu'elle apparaît — même cause de CLS que
          le badge de remise juste en dessous. */}
      {!compact && <div className="mt-1 min-h-[15px]"><ResumeAvis productId={produit.id} taille={12} className="" /></div>}
      <p className="mt-1 text-sm">
        {promo && <span className="mr-2 text-xs text-gray-400 line-through">{fmtPrix(produit.compare_at)}</span>}
        <span className="font-semibold">{fmtPrix(produit.price)}</span>
      </p>
      {/* Hauteur réservée même sans palier : les remises arrivent après le
          premier rendu (chargées depuis Supabase), et ce badge qui apparaît
          d'un coup sous CHAQUE carte de la grille décalait tout ce qui suit
          (avis, pied de page) d'autant de fois qu'il y a de cartes — la
          plus grosse cause de décalage de mise en page (CLS) de la page
          d'accueil. Pas de hauteur réservée en mode compact : la section
          vedette n'a que 3-4 lignes de texte à côté, pas une grille entière
          à protéger d'un saut. */}
      {!compact && (
        <div className="mt-1 min-h-[20px]">
          {paliers?.length > 0 && (
            <p className="inline-flex items-center bg-red-50 text-red-600 text-[10px] font-medium px-2 py-0.5 rounded-full">
              {remisePalier(paliers[0].pourcent, paliers[0].rang)}
            </p>
          )}
        </div>
      )}
    </Link>
  );
}

// Sans ce memo, l'intervalle du carrousel du Hero (toutes les 3s) re-rendait
// chaque carte de chaque grille de la page d'accueil, même inchangée —
// une des plus grosses causes du temps de blocage total (TBT).
export default React.memo(CarteProduit);
