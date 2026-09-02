import React from 'react';
import { Link } from 'react-router-dom';
import { X, Minus, Plus, Tag } from 'lucide-react';
import { fmtPrix, totalPanier, lignesAvecRemise } from '../lib/pricing';
import { cleLigne } from '../lib/panier';

export default function TiroirPanier({ ouvert, lignes, paliers, remises, livraison, seuilGratuit, onFermer, onQuantite, onRetirer }) {
  if (!ouvert) return null;
  const t = totalPanier(lignes, { paliers, remises, livraison, seuilGratuit });
  // La remise de chaque article, pas seulement le total en bas — le client
  // voit tout de suite POURQUOI le prix a changé sur cette ligne précise.
  const lignesRemisees = lignesAvecRemise(lignes, remises?.length ? remises : (paliers?.length ? [{ active: true, paliers }] : []));
  // Ce qu'il manque pour atteindre la livraison gratuite : un rappel concret
  // pousse à ajouter un article, là où « livraison offerte » seul ne dit rien
  // de ce qu'il reste à faire.
  const apresRemises = t.sousTotal - t.remiseQuantite;
  const manqueLivraison = seuilGratuit > 0 && apresRemises < seuilGratuit ? seuilGratuit - apresRemises : 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30" onClick={onFermer} />
      <aside className="relative bg-white w-full max-w-md h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm tracking-widest uppercase">Votre panier</h2>
          <button onClick={onFermer} className="p-1.5 text-gray-400 hover:text-ink" aria-label="Fermer"><X size={18} /></button>
        </div>

        {lignes.length === 0 ? (
          <p className="flex-1 grid place-items-center text-sm text-gray-400">Votre panier est vide</p>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {lignesRemisees.map(l => (
              <div key={cleLigne(l)} className="flex gap-3 p-4">
                <div className="w-20 h-24 bg-sand shrink-0">
                  {l.image && <img src={l.image} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">{l.name}</p>
                  {l.color && <p className="text-xs text-gray-400 mt-0.5">Couleur : {l.color}</p>}
                  {l.size && <p className="text-xs text-gray-400">Taille : {l.size}</p>}
                  {l.remiseDh > 0 && (
                    <span className="inline-block mt-1.5 bg-ink text-white text-[10px] font-medium px-2 py-1 rounded">
                      RÉDUCTION {l.remisePourcent}% (−{fmtPrix(l.remiseDh)})
                    </span>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => onQuantite(cleLigne(l), l.qty - 1)}
                      className="w-7 h-7 border border-gray-200 grid place-items-center" aria-label="Diminuer">
                      <Minus size={12} />
                    </button>
                    <span className="text-sm w-6 text-center">{l.qty}</span>
                    <button onClick={() => onQuantite(cleLigne(l), l.qty + 1)}
                      className="w-7 h-7 border border-gray-200 grid place-items-center" aria-label="Augmenter">
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
                    className="mt-2 text-gray-300 hover:text-red-500" aria-label="Retirer"><X size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {lignes.length > 0 && (
          <div className="border-t border-gray-100 p-5 space-y-2">
            {seuilGratuit > 0 && (
              <p className="text-xs text-gray-500 mb-1">
                {manqueLivraison > 0
                  ? <>Plus que <b className="text-ink">{fmtPrix(manqueLivraison)}</b> pour la livraison gratuite</>
                  : <span className="text-green-700">✓ Livraison gratuite</span>}
              </p>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Sous-total</span><span>{fmtPrix(t.sousTotal)}</span>
            </div>
            {t.remiseQuantite > 0 && (
              <div className="flex justify-between text-sm text-green-700">
                <span className="flex items-center gap-1.5"><Tag size={13} /> Remise</span>
                <span className="font-medium">−{fmtPrix(t.remiseQuantite)}</span>
              </div>
            )}
            <Link to="/commander" onClick={onFermer}
              className="mt-3 block bg-ink text-white text-center py-3.5 text-xs tracking-widest uppercase">
              Commander — {fmtPrix(t.total)}
              <span className="block text-[10px] text-gray-300 mt-0.5 normal-case tracking-normal">
                Paiement à la livraison
              </span>
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
