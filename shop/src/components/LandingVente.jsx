import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { fmtPrix } from '../lib/pricing';
import { cleLigne } from '../lib/panier';
import { useLang } from '../lib/i18n';
import GarantiesGrid from './GarantiesGrid';
import AvisProduit from './AvisProduit';
import OffreTimer from './OffreTimer';

// Même chargement différé que dans App.jsx (son code n'est pas nécessaire
// avant que le formulaire n'apparaisse) — importé ici une seconde fois,
// Vite/React partagent le même chunk, pas de doublon de code téléchargé.
const Commander = lazy(() => import('../pages/Commander'));

/* Page de vente longue (landing page de pub), pour un produit "non listé" —
   un seul article à vendre, un seul geste à faire : défilement vertical,
   argumentaire, formulaire déjà sous les yeux. Tout le contraire de la fiche
   produit classique (grille 2 colonnes, comparaison entre articles) : ici
   rien ne doit détourner du scroll vers l'achat.

   Le formulaire de commande (nom, téléphone, ville, adresse) est visible DÈS
   L'ARRIVÉE sur la page — pas besoin de cliquer "Acheter" d'abord — et
   l'article y est déjà présent : un client déjà convaincu par l'argumentaire
   n'a aucun clic de plus à faire avant de taper ses coordonnées.

   Remise par quantité (ex. "2 pour 450 DH") : ce n'est pas un prix codé en
   dur ici, mais la remise par palier déjà existante du site (réglée depuis
   /store/remises, par collection) — prendre 2 exemplaires du même article
   déclenche la même remise que prendre 2 articles différents de la même
   collection. Le total exact s'affiche dans le récapitulatif du formulaire
   ci-dessous dès que la quantité change. */
export default function LandingVente({ produit, photos, taille, setTaille, tailles, stockTaille, promo, theme,
  lignes, reglages, onQuantite, onRetirer, onVider, onAjouterAuPanier }) {
  const { t, lang } = useLang();
  const ar = lang === 'ar';
  const [zoomUrl, setZoomUrl] = useState(null);

  // Une ligne par argument — l'admin tape ses points forts dans "Détails"
  // du formulaire produit (un par ligne), affichés ici en liste à coches
  // plutôt qu'en paragraphe : c'est ce format, pas le texte en continu, qui
  // se lit en diagonale dans un argumentaire de vente.
  const arguments_ = String(produit.details || '').split('\n').map(l => l.trim()).filter(Boolean);

  const epuise = tailles.length > 0 && !tailles.some(s => s.stock > 0);

  // Ajout automatique au panier dès que la page (et une taille, s'il y en a)
  // est prête — le formulaire ci-dessous a donc toujours un article à
  // commander, sans attendre un clic sur un bouton "Acheter" séparé.
  useEffect(() => {
    if (epuise) return;
    if (tailles.length > 0 && !taille) return;
    onAjouterAuPanier();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produit.id, taille, epuise]);

  const cle = cleLigne({ slug: produit.slug, size: taille || '' });
  const ligneActuelle = lignes.find(l => cleLigne(l) === cle);
  const quantite = ligneActuelle?.qty || 1;

  function allerAuFormulaire() {
    document.getElementById('lv-commande')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 pb-28" dir={ar ? 'rtl' : 'ltr'}>
      {produit.is_bestseller && (
        <p className="inline-flex items-center bg-gradient-to-r from-amber-500 to-red-500 text-white
                      text-[10px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-sm mb-3">
          {t('meilleureVente')}
        </p>
      )}
      <h1 className="text-2xl font-bold leading-tight">{produit.name}</h1>

      <div className="mt-2 flex items-center gap-3">
        <bdi><span className="text-2xl font-extrabold text-orange-600">{fmtPrix(produit.price, lang)}</span></bdi>
        {promo && <bdi><span className="text-sm text-red-500 line-through">{fmtPrix(produit.compare_at, lang)}</span></bdi>}
      </div>
      {promo && <OffreTimer className="mt-2" />}

      {/* Visuel principal — en hauteur NATURELLE (pas un carré rogné) : une
          landing page vient souvent d'un visuel déjà entièrement composé
          (Canva, très haut, texte+preuves+arguments déjà dedans), que
          recadrer en carré couperait n'importe où. */}
      <div className="mt-4 rounded-xl overflow-hidden">
        {photos[0]?.video
          ? <video src={photos[0].video} className="w-full h-auto" controls playsInline autoPlay muted loop />
          : photos[0]?.url
          ? <img src={photos[0].url} alt={produit.name} className="w-full h-auto cursor-zoom-in"
              onClick={() => setZoomUrl(photos[0].url)} />
          : null}
      </div>

      {arguments_.length > 0 && (
        <ul className="mt-5 space-y-2.5 bg-sand/60 rounded-xl p-4">
          {arguments_.map((a, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-gray-800">
              <Check size={16} className="shrink-0 mt-0.5 text-green-600" strokeWidth={3} />
              <span>{a}</span>
            </li>
          ))}
        </ul>
      )}

      {produit.description && <p className="mt-5 text-sm text-gray-600 leading-relaxed">{produit.description}</p>}

      <div id="lv-tailles" className="mt-6">
        {tailles.length > 0 && (
          <>
            <p className="text-[13px] font-medium text-ink mb-2">{t('tailleLabel')}</p>
            <div className="flex flex-wrap gap-2">
              {tailles.map(s => {
                const indispo = !(s.stock > 0);
                return (
                  <button key={s.size} type="button" disabled={indispo} onClick={() => setTaille(s.size)}
                    className={`min-w-[3rem] px-3 py-2.5 text-sm border transition-colors relative
                      ${indispo ? 'border-gray-200 text-ink cursor-not-allowed'
                        : taille === s.size ? 'border-ink bg-ink text-white' : 'border-gray-200 hover:border-gray-400'}`}>
                    {s.size}
                  </button>
                );
              })}
            </div>
            {taille && stockTaille > 0 && stockTaille <= 5 && (
              <p className="mt-2 text-xs font-medium text-red-600">
                {ar ? `⚡ غير ${stockTaille} قطع متبقية!` : `⚡ Plus que ${stockTaille} en stock !`}
              </p>
            )}
          </>
        )}

        {/* Pas de taille sur ce produit : une quantité à choisir à la place.
            Le prix exact pour 2+ (remise par palier réglée dans
            /store/remises) se lit dans le récapitulatif du formulaire
            juste en dessous, pas ici — deux chiffres différents à deux
            endroits de la page serait l'assurance d'une contestation. */}
        {tailles.length === 0 && ligneActuelle && (
          <div className="mb-4">
            <p className="text-[13px] font-medium text-ink mb-2">{ar ? 'الكمية' : 'Quantité'}</p>
            <div className="inline-flex items-center border border-gray-200 rounded-lg overflow-hidden">
              <button type="button" onClick={() => onQuantite(cle, Math.max(1, quantite - 1))}
                className="w-10 h-10 grid place-items-center text-lg text-gray-500 hover:bg-gray-50">−</button>
              <span className="w-10 text-center font-medium">{quantite}</span>
              <button type="button" onClick={() => onQuantite(cle, quantite + 1)}
                className="w-10 h-10 grid place-items-center text-lg text-gray-500 hover:bg-gray-50">+</button>
            </div>
          </div>
        )}

      </div>

      {/* Formulaire de commande intégré — visible dès l'arrivée sur la page
          (pas besoin de cliquer "Acheter" d'abord), avec l'article déjà
          présent. Même composant que le reste du site (promo, livraison
          gratuite, pixels…), simplement affiché en place plutôt que dans une
          fenêtre superposée. */}
      {ligneActuelle && (
        <div id="lv-commande" className="mt-6 border border-gray-200 rounded-xl overflow-hidden scroll-mt-4">
          <Suspense fallback={<div className="p-10 text-center text-sm text-gray-400">…</div>}>
            <Commander lignes={lignes} reglages={reglages} onQuantite={onQuantite} onRetirer={onRetirer} onVider={onVider} />
          </Suspense>
        </div>
      )}

      <GarantiesGrid />

      {/* Galerie longue : chaque photo supplémentaire en pleine largeur, à la
          suite — le format "scroll infini d'images" des pages de vente
          (usage, détail, mise en situation), pas une grille ni un carrousel. */}
      {photos.slice(1).filter(p => p.url).length > 0 && (
        <div className="mt-8 space-y-3">
          {photos.slice(1).filter(p => p.url).map((img, i) => (
            <img key={i} src={img.url} alt={img.alt || produit.name} loading="lazy"
              className="w-full h-auto rounded-xl cursor-zoom-in" onClick={() => setZoomUrl(img.url)} />
          ))}
        </div>
      )}

      <div className="mt-10">
        <AvisProduit productId={produit.id} />
      </div>

      {/* Barre collante : le bouton d'achat reste toujours accessible, même
          après un long défilement dans l'argumentaire ou la galerie — sans
          elle, un client convaincu en bas de page doit remonter jusqu'en
          haut pour acheter, une friction de trop sur une page justement
          conçue pour n'en laisser aucune. */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <bdi className="shrink-0 font-extrabold text-orange-600">{fmtPrix(produit.price, lang)}</bdi>
          <button disabled={epuise} onClick={allerAuFormulaire}
            className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-3 text-sm font-semibold tracking-widest uppercase
                       disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
            {epuise ? t('epuiseTampon') : t('acheterMaintenant')}
          </button>
        </div>
      </div>

      {zoomUrl && (
        <div className="fixed inset-0 bg-black z-50 overflow-auto" onClick={() => setZoomUrl(null)}>
          <button onClick={() => setZoomUrl(null)} aria-label="Fermer"
            className="fixed top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/90 grid place-items-center">
            <X size={20} className="text-ink" />
          </button>
          <div className="min-h-full flex items-center justify-center p-4">
            <img src={zoomUrl} alt="" className="max-w-full max-h-full object-contain" onClick={e => e.stopPropagation()} />
          </div>
        </div>
      )}
    </div>
  );
}
