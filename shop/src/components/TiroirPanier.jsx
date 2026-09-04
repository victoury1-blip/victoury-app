import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Minus, Plus, Tag } from 'lucide-react';
import { fmtPrix, totalPanier, lignesAvecRemise } from '../lib/pricing';
import { prochainPalier } from '../lib/remises';
import { cleLigne } from '../lib/panier';
import { chargerNouveautes, chargerProduitsParCollections } from '../lib/catalog';
import { useLang } from '../lib/i18n';

export default function TiroirPanier({ ouvert, lignes, paliers, remises, livraison, seuilGratuit, onFermer, onQuantite, onRetirer }) {
  const { t, encoreEtRemise, etLivraisonGratuite } = useLang();
  const [suggestions, setSuggestions] = useState([]);

  // Chargées à l'ouverture seulement : inutile de sonder Supabase à chaque
  // ajout/retrait d'article, la sélection n'a pas à changer pendant que le
  // client regarde son panier.
  useEffect(() => {
    if (!ouvert) return;
    const collectionIds = [...new Set(lignes.map(l => l.collectionId).filter(Boolean))];
    (collectionIds.length ? chargerProduitsParCollections(collectionIds, 8) : chargerNouveautes(6))
      .then(setSuggestions).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert]);

  if (!ouvert) return null;
  const tot = totalPanier(lignes, { paliers, remises, livraison, seuilGratuit });
  // La remise de chaque article, pas seulement le total en bas — le client
  // voit tout de suite POURQUOI le prix a changé sur cette ligne précise.
  const remisesEffectives = remises?.length ? remises : (paliers?.length ? [{ active: true, paliers }] : []);
  const lignesRemisees = lignesAvecRemise(lignes, remisesEffectives);
  // Ce qu'il manque pour atteindre la livraison gratuite : un rappel concret
  // pousse à ajouter un article, là où « livraison offerte » seul ne dit rien
  // de ce qu'il reste à faire.
  const apresRemises = tot.sousTotal - tot.remiseQuantite;
  const manqueLivraison = seuilGratuit > 0 && apresRemises < seuilGratuit ? seuilGratuit - apresRemises : 0;
  // Idem pour le prochain palier de remise quantité : « encore 1 article et
  // −20% » pousse plus fort qu'un badge qu'il faut déjà avoir vu ailleurs.
  const palierSuivant = prochainPalier(lignes, remisesEffectives);
  // "et livraison gratuite" ne s'ajoute que si c'est vrai — sinon ce serait
  // une promesse fausse au client qui n'a pas encore atteint le seuil.
  const livraisonDejaGratuite = !(seuilGratuit > 0) || manqueLivraison === 0;
  // Ne pas proposer un article déjà dans le panier — suggérer ce qu'on a
  // déjà choisi n'aide pas à ajouter un article de plus.
  const suggestionsPertinentes = suggestions.filter(s => !lignes.some(l => l.slug === s.slug)).slice(0, 4);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30" onClick={onFermer} />
      <aside className="relative bg-white w-full max-w-md h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm tracking-widest uppercase">{t('votrePanier')}</h2>
          <button onClick={onFermer} className="p-1.5 text-gray-400 hover:text-ink" aria-label="Fermer"><X size={18} /></button>
        </div>

        {palierSuivant && (
          <p className="px-5 py-2.5 bg-red-50 text-red-700 text-xs font-medium border-b border-red-100">
            {encoreEtRemise(palierSuivant.manque, palierSuivant.pourcent)}
            {livraisonDejaGratuite && etLivraisonGratuite()}
          </p>
        )}

        {lignes.length === 0 ? (
          <p className="flex-1 grid place-items-center text-sm text-gray-400">{t('panierVide')}</p>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {lignesRemisees.map(l => (
              <div key={cleLigne(l)} className="flex gap-3 p-4">
                <div className="w-20 h-24 bg-sand shrink-0">
                  {l.image && <img src={l.image} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">{l.name}</p>
                  {l.color && <p className="text-xs text-gray-400 mt-0.5">{t('couleur')} : {l.color}</p>}
                  {l.size && <p className="text-xs text-gray-400">{l.size}</p>}
                  {/* Rouge, comme partout ailleurs sur le site où une remise est
                      signalée (badge produit, prix barré, palier) — le noir est déjà
                      pris par le texte et les boutons, le rouge reste le signal promo. */}
                  {l.remiseDh > 0 && (
                    <span className="inline-block mt-1.5 bg-red-600 text-white text-[10px] font-medium px-2 py-1 rounded">
                      RÉDUCTION {l.remisePourcent}% (−{fmtPrix(l.remiseDh)})
                    </span>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => onQuantite(cleLigne(l), l.qty - 1)}
                      className="w-7 h-7 border border-gray-200 grid place-items-center" aria-label={t('quantiteMinus')}>
                      <Minus size={12} />
                    </button>
                    <span className="text-sm w-6 text-center">{l.qty}</span>
                    <button onClick={() => onQuantite(cleLigne(l), l.qty + 1)}
                      className="w-7 h-7 border border-gray-200 grid place-items-center" aria-label={t('quantitePlus')}>
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  {l.remiseDh > 0 ? (
                    <>
                      <p className="text-sm font-medium text-red-600">{fmtPrix(l.price * l.qty - l.remiseDh)}</p>
                      <p className="text-xs text-gray-400 line-through">{fmtPrix(l.price * l.qty)}</p>
                    </>
                  ) : (
                    <p className="text-sm font-medium">{fmtPrix(l.price * l.qty)}</p>
                  )}
                  <button onClick={() => onRetirer(cleLigne(l))}
                    className="mt-2 text-gray-300 hover:text-red-500" aria-label={t('retirer')}><X size={14} /></button>
                </div>
              </div>
            ))}

            {suggestionsPertinentes.length > 0 && (
              <div className="p-4">
                <p className="text-xs text-gray-500 mb-2.5">{t('profitezDuTarif')}</p>
                <div className="flex gap-2.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {suggestionsPertinentes.map(s => (
                    <Link key={s.id} to={`/product/${s.slug}/`} onClick={onFermer}
                      className="shrink-0 w-24 group">
                      <div className="w-24 h-28 bg-sand overflow-hidden">
                        {s.images?.[0]?.url && (
                          <img src={s.images[0].url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        )}
                      </div>
                      <p className="mt-1.5 text-[11px] text-gray-600 line-clamp-2">{s.name}</p>
                      <p className="text-[11px] font-medium">{fmtPrix(s.price)}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {lignes.length > 0 && (
          <div className="border-t border-gray-100 p-5 space-y-2">
            {seuilGratuit > 0 && (
              <p className="text-xs text-gray-500 mb-1">
                {manqueLivraison > 0
                  ? <>{t('plusQue')} <b className="text-ink">{fmtPrix(manqueLivraison)}</b> {t('pourLivraisonGratuite')}</>
                  : <span className="text-green-700">{t('livraisonGratuite')}</span>}
              </p>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('sousTotal')}</span><span>{fmtPrix(tot.sousTotal)}</span>
            </div>
            {tot.remiseQuantite > 0 && (
              <div className="flex justify-between text-sm text-green-700">
                <span className="flex items-center gap-1.5"><Tag size={13} /> {t('remise')}</span>
                <span className="font-medium">−{fmtPrix(tot.remiseQuantite)}</span>
              </div>
            )}
            <Link to="/commander" onClick={onFermer}
              className="mt-3 block bg-ink text-white text-center py-3.5 text-xs tracking-widest uppercase">
              {t('commander')} — {fmtPrix(tot.total)}
              <span className="block text-[10px] text-gray-300 mt-0.5 normal-case tracking-normal">
                {t('paiementLivraison')}
              </span>
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
