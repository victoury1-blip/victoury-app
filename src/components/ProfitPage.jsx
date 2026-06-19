import React, { useState, useMemo } from 'react';
import { TrendingUp, RefreshCw, ShoppingBag, Percent, Truck, DollarSign, Download } from 'lucide-react';
import { loadProducts } from '../data/products';

function fmt(n) { return Number(n || 0).toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function pct(val, total) { return total ? ((val / total) * 100).toFixed(1) : '0.0'; }

function KpiCard({ label, value, unit = 'MAD', subtitle, color, icon: Icon, progress }) {
  return (
    <div className={`bg-white border-l-4 ${color.border} rounded-xl p-5 shadow-sm`}>
      <div className="flex items-start justify-between mb-1">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
          <Icon size={13} className={color.icon} /> {label}
        </div>
      </div>
      <div className={`text-2xl font-black mt-2 ${color.text}`}>{fmt(value)} <span className="text-sm font-semibold">{unit}</span></div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
      {progress !== undefined && (
        <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${color.bar}`} style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
      )}
    </div>
  );
}

export default function ProfitPage({ orders = [] }) {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const lastDay  = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [dateFrom, setDateFrom] = useState(firstDay);
  const [dateTo,   setDateTo]   = useState(lastDay);
  const [fraisPub, setFraisPub] = useState(0);
  const [coutPct,  setCoutPct]  = useState(33);
  const [applied,  setApplied]  = useState({ dateFrom: firstDay, dateTo: lastDay, fraisPub: 0, coutPct: 33 });

  function apply() { setApplied({ dateFrom, dateTo, fraisPub: Number(fraisPub), coutPct: Number(coutPct) }); }
  function reset()  {
    setDateFrom(firstDay); setDateTo(lastDay); setFraisPub(0); setCoutPct(33);
    setApplied({ dateFrom: firstDay, dateTo: lastDay, fraisPub: 0, coutPct: 33 });
  }

  const inPeriod = useMemo(() => orders.filter(o => {
    if (!o.dateAdded) return true;
    const d = o.dateAdded.split('/').reverse().join('-');
    return d >= applied.dateFrom && d <= applied.dateTo;
  }), [orders, applied]);

  const livres = inPeriod.filter(o => o.status === 'livre');
  const stockProducts = useMemo(() => loadProducts(), []);

  function getProductCost(order) {
    const prods = order.products?.length ? order.products : [order.product];
    let cost = 0;
    for (const p of prods) {
      if (!p?.name) continue;
      const sp = stockProducts.find(s => s.name === p.name);
      if (sp && sp.prixAchat) {
        cost += (parseFloat(sp.prixAchat) || 0) * (p.qty || 1);
      } else {
        cost += (order.price || 0) * (applied.coutPct / 100) * ((p.qty || 1) / (prods.reduce((s, x) => s + (x?.qty || 1), 0) || 1));
      }
    }
    return cost;
  }

  const ca          = livres.reduce((s, o) => s + (o.price || 0), 0);
  const coutAchat   = livres.reduce((s, o) => s + getProductCost(o), 0);
  const margeB      = ca - coutAchat;
  const fraisLiv    = inPeriod.reduce((s, o) => s + (o.fraisLivraison || 0), 0);
  const fraisTotaux = fraisLiv + applied.fraisPub;
  const profitNet   = margeB - fraisTotaux;

  const selCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300';

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-auto">
      {/* Hero header */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 px-8 py-7 text-white">
        <div className="flex items-center gap-3 mb-1">
          <TrendingUp size={24} />
          <h1 className="text-2xl font-black">Rapport de Profit</h1>
        </div>
        <p className="text-blue-200 text-sm">Analyse détaillée de la rentabilité</p>
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-6 py-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Période :</label>
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={selCls} />
            <span className="text-gray-400 text-sm">–</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={selCls} />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Frais publicitaires (MAD) :</label>
          <input type="number" value={fraisPub} onChange={e => setFraisPub(e.target.value)} className={`${selCls} w-32`} min={0} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Taux coût d'achat (%) :</label>
          <input type="number" value={coutPct} onChange={e => setCoutPct(e.target.value)} className={`${selCls} w-24`} min={0} max={100} />
        </div>
        <div className="flex gap-2">
          <button onClick={apply} className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-semibold hover:bg-gray-900">Filtrer</button>
          <button onClick={reset} className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
            <RefreshCw size={13} /> Réinitialiser
          </button>
          <button onClick={() => {
            const rows = [['ID','Client','Date','Produit','Prix Vente','Prix Achat','Frais Livraison','Marge'].join(',')];
            livres.forEach(o => {
              const pa = getProductCost(o); const m = (o.price||0) - pa - (o.fraisLivraison||0);
              rows.push([o.id, o.recipient?.name||'', o.dateAdded||'', o.product?.name||'', o.price||0, pa.toFixed(2), o.fraisLivraison||0, m.toFixed(2)].join(','));
            });
            const blob = new Blob(['﻿'+rows.join('\n')], {type:'text/csv;charset=utf-8'});
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
            a.download = `profit_${applied.dateFrom}_${applied.dateTo}.csv`; a.click();
          }} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700">
            <Download size={13} /> Exporter
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Chiffre d'Affaires" value={ca} icon={ShoppingBag}
            subtitle={`${livres.length} commandes livrées`}
            color={{ border: 'border-blue-500', icon: 'text-blue-500', text: 'text-blue-700', bar: 'bg-blue-500' }} />
          <KpiCard label="Marge Brute" value={margeB} icon={Percent}
            subtitle={`${pct(margeB, ca)}% du CA`} progress={parseFloat(pct(margeB, ca))}
            color={{ border: 'border-green-500', icon: 'text-green-500', text: 'text-green-700', bar: 'bg-green-500' }} />
          <KpiCard label="Frais Totaux" value={fraisTotaux} icon={Truck}
            subtitle={`Livraison: ${fmt(fraisLiv)} | Pub: ${fmt(applied.fraisPub)}`}
            color={{ border: 'border-orange-400', icon: 'text-orange-500', text: 'text-orange-600', bar: 'bg-orange-400' }} />
          <KpiCard label="Profit Net" value={profitNet} icon={DollarSign}
            subtitle={`${pct(profitNet, ca)}% du CA`} progress={Math.max(0, parseFloat(pct(profitNet, ca)))}
            color={{ border: 'border-teal-500', icon: 'text-teal-500', text: profitNet >= 0 ? 'text-teal-700' : 'text-red-600', bar: 'bg-teal-500' }} />
        </div>

        {/* Répartition des coûts */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-bold text-gray-700 mb-4 flex items-center gap-2 text-sm">
            <span className="text-base">⏱</span> Répartition des coûts
          </h2>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-sm bg-red-500" />
                <span className="text-xs font-semibold text-gray-600">Coût d'achat</span>
              </div>
              <div className="font-black text-gray-800 text-lg">{fmt(coutAchat)} <span className="text-sm font-semibold">MAD</span></div>
              <div className="text-xs text-gray-400 mt-0.5">{pct(coutAchat, ca)}% du CA</div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-sm bg-orange-400" />
                <span className="text-xs font-semibold text-gray-600">Frais de livraison</span>
              </div>
              <div className="font-black text-gray-800 text-lg">{fmt(fraisLiv)} <span className="text-sm font-semibold">MAD</span></div>
              <div className="text-xs text-gray-400 mt-0.5">{pct(fraisLiv, ca)}% du CA</div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-sm bg-blue-400" />
                <span className="text-xs font-semibold text-gray-600">Frais publicitaires</span>
              </div>
              <div className="font-black text-gray-800 text-lg">{fmt(applied.fraisPub)} <span className="text-sm font-semibold">MAD</span></div>
              <div className="text-xs text-gray-400 mt-0.5">{pct(applied.fraisPub, ca)}% du CA</div>
            </div>
          </div>
        </div>

        {/* Liste des commandes */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50 flex items-center gap-2">
            <span className="text-sm">≡</span>
            <h2 className="font-bold text-gray-700 text-sm">Liste des commandes ({livres.length})</h2>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['ID Colis','Client','Date','Produits','Prix Vente','Prix Achat','Frais Livraison','Marge'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {livres.length === 0 && (
                  <tr><td colSpan={8} className="py-10 text-center text-gray-400 text-sm">Aucune commande livrée dans cette période</td></tr>
                )}
                {livres.map(o => {
                  const prixVente = o.price || 0;
                  const prixAchat = getProductCost(o);
                  const fraisL    = o.fraisLivraison || 0;
                  const marge     = prixVente - prixAchat - fraisL;
                  return (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono text-xs font-bold text-blue-600">{o.id}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-700">{o.recipient?.name || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{o.dateAdded || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-600 max-w-[180px] truncate">{o.product?.name || '—'}</td>
                      <td className="px-4 py-2.5 font-semibold text-gray-800">{fmt(prixVente)}</td>
                      <td className="px-4 py-2.5 text-red-500 text-xs font-semibold">{fmt(prixAchat)}</td>
                      <td className="px-4 py-2.5 text-orange-500 text-xs">{fmt(fraisL)}</td>
                      <td className={`px-4 py-2.5 font-bold text-xs ${marge >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(marge)}</td>
                    </tr>
                  );
                })}
              </tbody>
              {livres.length > 0 && (
                <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-xs font-bold text-gray-600">TOTAL ({livres.length})</td>
                    <td className="px-4 py-3 font-black text-gray-800">{fmt(ca)}</td>
                    <td className="px-4 py-3 font-bold text-red-500">{fmt(coutAchat)}</td>
                    <td className="px-4 py-3 font-bold text-orange-500">{fmt(fraisLiv)}</td>
                    <td className={`px-4 py-3 font-black ${profitNet >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(profitNet)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
