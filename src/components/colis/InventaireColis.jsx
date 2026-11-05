import React, { useEffect, useMemo, useState } from 'react';
import { Truck, XCircle, Ban, Repeat, Warehouse, AlertOctagon, Sigma, ChevronDown, Pencil, Check } from 'lucide-react';
import { inventaire } from '../../lib/inventaire';
import { chargerStockManuel, lireStockManuelCache } from '../../lib/stockManuel';
import { cloudGet, cloudSet, localGet } from '../../lib/cloudSettings';

/* « Où sont mes pièces ? » en haut de la Liste des Colis.
 * Livraison et retours se calculent depuis les commandes ; le stock au local
 * est celui de la page Stock ; les défectueuses (abîmées, invendables) se
 * comptent à la main ici. Total = tout ce qui t'appartient encore. */

const CLE_DEFAUT = 'stock_defectueux';
const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');

function Carte({ icon: Icon, titre, valeur, sous, cls, children }) {
  return (
    <div className={`rounded-xl border p-3 min-w-0 ${cls}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide opacity-80">
        <Icon size={13} className="shrink-0" /> <span className="truncate">{titre}</span>
      </div>
      <div className="mt-1 text-2xl font-black tabular-nums leading-tight">{valeur}</div>
      {sous && <div className="text-[11px] opacity-75 mt-0.5">{sous}</div>}
      {children}
    </div>
  );
}

export default function InventaireColis({ orders, recuIds }) {
  const [ouvert, setOuvert] = useState(() => localStorage.getItem('inventaire_colis_ouvert') !== '0');
  const [stockLocal, setStockLocal] = useState(lireStockManuelCache);
  const [defauts, setDefauts] = useState(() => { const v = localGet(CLE_DEFAUT); return typeof v === 'number' ? v : 0; });
  const [saisie, setSaisie] = useState(null);

  useEffect(() => {
    chargerStockManuel().then(v => setStockLocal(v)).catch(() => {});
    cloudGet(CLE_DEFAUT).then(v => { if (typeof v === 'number') setDefauts(v); }).catch(() => {});
  }, []);

  const r = useMemo(() => inventaire(orders, recuIds), [orders, recuIds]);
  const total = r.enLivraison.pieces + r.aRecuperer + stockLocal + defauts;

  const basculer = () => setOuvert(o => { localStorage.setItem('inventaire_colis_ouvert', o ? '0' : '1'); return !o; });
  async function enregistrerDefauts() {
    const v = Math.max(0, parseInt(saisie, 10) || 0);
    setDefauts(v); setSaisie(null);
    await cloudSet(CLE_DEFAUT, v);
  }

  return (
    <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3">
      <button type="button" onClick={basculer} className="w-full flex items-center gap-2 text-left">
        <span className="text-sm font-bold text-gray-800">Où sont mes pièces ?</span>
        <span className="text-xs text-gray-500">Total <b className="text-gray-900">{fmt(total)}</b> pièces</span>
        <ChevronDown size={16} className={`ms-auto text-gray-400 transition-transform ${ouvert ? 'rotate-180' : ''}`} />
      </button>

      {ouvert && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
          <Carte icon={Truck} titre="Chez le livreur" valeur={fmt(r.enLivraison.pieces)} sous={`${fmt(r.enLivraison.colis)} colis en route`}
            cls="bg-sky-50 border-sky-200 text-sky-800" />
          <Carte icon={XCircle} titre="Refusés" valeur={fmt(r.refuses.aRecuperer)} sous={`à récupérer · ${fmt(r.refuses.recus)} déjà reçus`}
            cls="bg-red-50 border-red-200 text-red-700" />
          <Carte icon={Ban} titre="Annulés" valeur={fmt(r.annules.aRecuperer)} sous={`à récupérer · ${fmt(r.annules.recus)} déjà reçus`}
            cls="bg-orange-50 border-orange-200 text-orange-700" />
          <Carte icon={Repeat} titre="Échanges" valeur={fmt(r.echanges.aRecuperer)} sous={`ancien article à récupérer · ${fmt(r.echanges.recus)} reçus`}
            cls="bg-amber-50 border-amber-200 text-amber-800" />
          <Carte icon={Warehouse} titre="Stock au local" valeur={fmt(stockLocal)} sous="réglé dans la page Stock"
            cls="bg-indigo-50 border-indigo-200 text-indigo-800" />
          <Carte icon={AlertOctagon} titre="Défectueux" valeur={saisie === null ? fmt(defauts) : ''}
            sous={saisie === null ? 'abîmés / invendables' : undefined} cls="bg-gray-50 border-gray-200 text-gray-700">
            {saisie === null ? (
              <button type="button" onClick={() => setSaisie(String(defauts))} className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-800">
                <Pencil size={11} /> Modifier
              </button>
            ) : (
              <div className="mt-1 flex items-center gap-1">
                <input autoFocus type="number" min={0} value={saisie} onChange={e => setSaisie(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') enregistrerDefauts(); if (e.key === 'Escape') setSaisie(null); }}
                  className="w-20 text-sm border border-gray-300 rounded px-2 py-1 bg-white" />
                <button type="button" onClick={enregistrerDefauts} className="p-1.5 rounded bg-gray-800 text-white"><Check size={13} /></button>
              </div>
            )}
          </Carte>
          <Carte icon={Sigma} titre="Total" valeur={fmt(total)} sous="livreur + à récupérer + local + défectueux"
            cls="bg-gray-900 border-gray-900 text-white" />
        </div>
      )}
    </div>
  );
}
