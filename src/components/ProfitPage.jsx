import React, { useState, useMemo, useEffect } from 'react';
import { TrendingUp, RefreshCw, ShoppingBag, Percent, Truck, DollarSign, Download, Plus, Trash2, Receipt } from 'lucide-react';
import { loadProducts } from '../data/products';
import { supabase } from '../lib/supabase';
import { cloudGet } from '../lib/cloudSettings';

function fmt(n) { return Number(n || 0).toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function pct(val, total) { return total ? ((val / total) * 100).toFixed(1) : '0.0'; }

function KpiCard({ label, value, unit = 'MAD', subtitle, color, icon: Icon, progress }) {
  return (
    <div className={`bg-white border-l-4 ${color.border} rounded-xl p-5 shadow-sm`}>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
        <Icon size={13} className={color.icon} /> {label}
      </div>
      <div className={`text-2xl font-black mt-2 ${color.text}`}>{fmt(value)} <span className="text-sm font-semibold">{unit}</span></div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
      {progress !== undefined && (
        <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${color.bar}`} style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }} />
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
  const [coutPct,  setCoutPct]  = useState(33);
  const [applied,  setApplied]  = useState({ dateFrom: firstDay, dateTo: lastDay, coutPct: 33 });

  // Ad spend transfers
  const [adTransfers, setAdTransfers] = useState([]);
  const [newTransfer, setNewTransfer] = useState({ label: '', amount: '' });
  const [showAdModal, setShowAdModal] = useState(false);

  // Delivery fees lookup
  const [deliveryFees, setDeliveryFees] = useState({});

  useEffect(() => {
    // Load ad transfers from supabase
    supabase.from('settings').select('value').eq('key', 'ad_transfers').single().then(({ data }) => {
      if (Array.isArray(data?.value)) setAdTransfers(data.value);
    });
    // Load delivery fees from all livreurs
    const livreurs = JSON.parse(localStorage.getItem('livreurs') || '[]');
    const ids = livreurs.length ? livreurs.map(l => l.id) : [1];
    Promise.all(ids.map(id => cloudGet(`frais_${id}`).then(d => ({ id, data: d })))).then(results => {
      const map = {};
      for (const r of results) {
        if (Array.isArray(r.data)) {
          for (const f of r.data) {
            const city = (f.ville || f.city || '').toLowerCase().trim();
            if (city && f.frais != null) map[city] = parseFloat(f.frais) || 0;
          }
        }
      }
      setDeliveryFees(map);
    });
  }, []);

  function saveAdTransfers(list) {
    setAdTransfers(list);
    supabase.from('settings').upsert(
      { key: 'ad_transfers', value: list, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    ).then(() => {});
  }

  function addTransfer() {
    if (!newTransfer.amount) return;
    const entry = {
      id: Date.now(),
      label: newTransfer.label || 'Transfert pub',
      amount: parseFloat(newTransfer.amount) || 0,
      date: new Date().toISOString().slice(0, 10),
    };
    saveAdTransfers([...adTransfers, entry]);
    setNewTransfer({ label: '', amount: '' });
  }

  function removeTransfer(id) {
    saveAdTransfers(adTransfers.filter(t => t.id !== id));
  }

  function apply() { setApplied({ dateFrom, dateTo, coutPct: Number(coutPct) }); }
  function reset() {
    setDateFrom(firstDay); setDateTo(lastDay); setCoutPct(33);
    setApplied({ dateFrom: firstDay, dateTo: lastDay, coutPct: 33 });
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

  function getDeliveryCost(order) {
    const city = (order.recipient?.city || '').toLowerCase().trim();
    if (deliveryFees[city] != null) return deliveryFees[city];
    // Try partial match
    for (const [k, v] of Object.entries(deliveryFees)) {
      if (city.includes(k) || k.includes(city)) return v;
    }
    return 0;
  }

  // Calculations
  const ca = livres.reduce((s, o) => s + (o.price || 0), 0);
  const coutAchat = livres.reduce((s, o) => s + getProductCost(o), 0);
  const fraisLiv = livres.reduce((s, o) => s + getDeliveryCost(o), 0);
  const sousTotal = ca - coutAchat - fraisLiv;
  const totalPub = adTransfers.reduce((s, t) => s + (t.amount || 0), 0);
  const profitNet = sousTotal - totalPub;

  const selCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300';

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-auto">
      {/* Hero header */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 px-6 sm:px-8 py-7 text-white">
        <div className="flex items-center gap-3 mb-1">
          <TrendingUp size={24} />
          <h1 className="text-xl sm:text-2xl font-black">Rapport de Profit</h1>
        </div>
        <p className="text-blue-200 text-sm">Analyse détaillée de la rentabilité</p>
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-4 sm:px-6 py-4 flex flex-wrap items-end gap-3 sm:gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Période :</label>
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={selCls} />
            <span className="text-gray-400 text-sm">–</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={selCls} />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Taux coût d'achat (%) :</label>
          <input type="number" value={coutPct} onChange={e => setCoutPct(e.target.value)} className={`${selCls} w-24`} min={0} max={100} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={apply} className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-semibold hover:bg-gray-900">Filtrer</button>
          <button onClick={reset} className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
            <RefreshCw size={13} /> Réinitialiser
          </button>
          <button onClick={() => {
            const rows = [['ID','Client','Ville','Date','Produit','Prix Vente','Prix Achat','Frais Livraison','Marge'].join(',')];
            livres.forEach(o => {
              const pa = getProductCost(o); const fl = getDeliveryCost(o); const m = (o.price||0) - pa - fl;
              rows.push([o.id, o.recipient?.name||'', o.recipient?.city||'', o.dateAdded||'', o.product?.name||'', o.price||0, pa.toFixed(2), fl.toFixed(2), m.toFixed(2)].join(','));
            });
            rows.push('');
            rows.push(`Total Pub,${totalPub.toFixed(2)}`);
            rows.push(`Profit Net,${profitNet.toFixed(2)}`);
            const blob = new Blob(['﻿'+rows.join('\n')], {type:'text/csv;charset=utf-8'});
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
            a.download = `profit_${applied.dateFrom}_${applied.dateTo}.csv`; a.click();
          }} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700">
            <Download size={13} /> Exporter
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 sm:p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Chiffre d'Affaires" value={ca} icon={ShoppingBag}
            subtitle={`${livres.length} commandes livrées`}
            color={{ border: 'border-blue-500', icon: 'text-blue-500', text: 'text-blue-700', bar: 'bg-blue-500' }} />
          <KpiCard label="Marge Brute" value={sousTotal} icon={Percent}
            subtitle={`CA - Achat - Livraison`} progress={parseFloat(pct(sousTotal, ca))}
            color={{ border: 'border-green-500', icon: 'text-green-500', text: 'text-green-700', bar: 'bg-green-500' }} />
          <KpiCard label="Frais Publicitaires" value={totalPub} icon={Receipt}
            subtitle={`${adTransfers.length} transfert${adTransfers.length > 1 ? 's' : ''}`}
            color={{ border: 'border-orange-400', icon: 'text-orange-500', text: 'text-orange-600', bar: 'bg-orange-400' }} />
          <KpiCard label="Profit Net" value={profitNet} icon={DollarSign}
            subtitle={`${pct(profitNet, ca)}% du CA`} progress={Math.max(0, parseFloat(pct(profitNet, ca)))}
            color={{ border: 'border-teal-500', icon: 'text-teal-500', text: profitNet >= 0 ? 'text-teal-700' : 'text-red-600', bar: 'bg-teal-500' }} />
        </div>

        {/* Formula breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-bold text-gray-700 mb-4 text-sm">Détail du calcul</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-center text-center">
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="text-[10px] font-semibold text-gray-500 uppercase">Prix de vente</div>
              <div className="text-lg font-black text-blue-700">{fmt(ca)}</div>
            </div>
            <div className="text-gray-400 font-bold text-xl hidden sm:block">−</div>
            <div className="bg-red-50 rounded-xl p-4">
              <div className="text-[10px] font-semibold text-gray-500 uppercase">Coût d'achat</div>
              <div className="text-lg font-black text-red-600">{fmt(coutAchat)}</div>
              <div className="text-[10px] text-gray-400">{pct(coutAchat, ca)}% du CA</div>
            </div>
            <div className="text-gray-400 font-bold text-xl hidden sm:block">−</div>
            <div className="bg-orange-50 rounded-xl p-4">
              <div className="text-[10px] font-semibold text-gray-500 uppercase">Frais livraison</div>
              <div className="text-lg font-black text-orange-600">{fmt(fraisLiv)}</div>
              <div className="text-[10px] text-gray-400">{pct(fraisLiv, ca)}% du CA</div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 my-4 text-sm text-gray-500">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="font-bold">= Sous-total: <span className="text-green-700">{fmt(sousTotal)} MAD</span></span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center text-center">
            <div className="bg-green-50 rounded-xl p-4">
              <div className="text-[10px] font-semibold text-gray-500 uppercase">Sous-total</div>
              <div className="text-lg font-black text-green-700">{fmt(sousTotal)}</div>
            </div>
            <div className="text-gray-400 font-bold text-xl hidden sm:block">−</div>
            <div className="bg-purple-50 rounded-xl p-4">
              <div className="text-[10px] font-semibold text-gray-500 uppercase">Pub / Ads</div>
              <div className="text-lg font-black text-purple-600">{fmt(totalPub)}</div>
              <button onClick={() => setShowAdModal(true)} className="text-[10px] text-purple-600 hover:underline mt-1">Gérer les transferts →</button>
            </div>
          </div>
          <div className="mt-4 bg-gradient-to-r from-teal-50 to-green-50 rounded-xl p-5 text-center border border-teal-200">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Profit Net Final</div>
            <div className={`text-3xl font-black ${profitNet >= 0 ? 'text-teal-700' : 'text-red-600'}`}>{fmt(profitNet)} <span className="text-sm font-semibold">MAD</span></div>
            <div className="text-xs text-gray-500 mt-1">{pct(profitNet, ca)}% du chiffre d'affaires</div>
          </div>
        </div>

        {/* Orders table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50 flex items-center gap-2">
            <h2 className="font-bold text-gray-700 text-sm">Commandes livrées ({livres.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['ID','Client','Ville','Date','Produit','Prix Vente','Coût Achat','Frais Liv.','Marge'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {livres.length === 0 && (
                  <tr><td colSpan={9} className="py-10 text-center text-gray-400 text-sm">Aucune commande livrée dans cette période</td></tr>
                )}
                {livres.map(o => {
                  const pv = o.price || 0;
                  const pa = getProductCost(o);
                  const fl = getDeliveryCost(o);
                  const marge = pv - pa - fl;
                  return (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono text-xs font-bold text-blue-600">{o.id}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-700">{o.recipient?.name || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{o.recipient?.city || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{o.dateAdded || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-600 max-w-[150px] truncate">{o.product?.name || '—'}</td>
                      <td className="px-4 py-2.5 font-semibold text-gray-800">{fmt(pv)}</td>
                      <td className="px-4 py-2.5 text-red-500 text-xs font-semibold">{fmt(pa)}</td>
                      <td className="px-4 py-2.5 text-orange-500 text-xs font-semibold">{fmt(fl)}</td>
                      <td className={`px-4 py-2.5 font-bold text-xs ${marge >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(marge)}</td>
                    </tr>
                  );
                })}
              </tbody>
              {livres.length > 0 && (
                <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-xs font-bold text-gray-600">TOTAL ({livres.length})</td>
                    <td className="px-4 py-3 font-black text-gray-800">{fmt(ca)}</td>
                    <td className="px-4 py-3 font-bold text-red-500">{fmt(coutAchat)}</td>
                    <td className="px-4 py-3 font-bold text-orange-500">{fmt(fraisLiv)}</td>
                    <td className={`px-4 py-3 font-black ${sousTotal >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(sousTotal)}</td>
                  </tr>
                  <tr className="border-t border-gray-300">
                    <td colSpan={8} className="px-4 py-2 text-xs font-bold text-gray-500 text-right">Pub:</td>
                    <td className="px-4 py-2 font-bold text-purple-600 text-xs">-{fmt(totalPub)}</td>
                  </tr>
                  <tr className="bg-teal-50">
                    <td colSpan={8} className="px-4 py-3 text-sm font-black text-gray-700 text-right">PROFIT NET :</td>
                    <td className={`px-4 py-3 font-black text-sm ${profitNet >= 0 ? 'text-teal-700' : 'text-red-600'}`}>{fmt(profitNet)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* Ad Transfers Modal */}
      {showAdModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowAdModal(false)}>
          <div className="fixed inset-0 bg-black/40" />
          <div className="relative bg-white rounded-t-xl sm:rounded-xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-xl z-10">
              <h2 className="text-lg font-bold text-gray-800">Transferts Publicitaires</h2>
              <button onClick={() => setShowAdModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 text-xl">&times;</button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-500">Ajoutez vos paiements de factures publicitaires (Facebook Ads, Google Ads, etc.). Le total sera déduit du sous-total pour calculer le profit net.</p>

              {/* List */}
              {adTransfers.length > 0 && (
                <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                  {adTransfers.map(t => (
                    <div key={t.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                      <div>
                        <div className="text-sm font-semibold text-gray-800">{t.label}</div>
                        <div className="text-xs text-gray-400">{t.date}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-black text-purple-600">{fmt(t.amount)} MAD</span>
                        <button onClick={() => removeTransfer(t.id)} className="p-1 rounded bg-red-50 text-red-500 hover:bg-red-100">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="px-4 py-2.5 bg-purple-50 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-600">TOTAL</span>
                    <span className="font-black text-purple-700">{fmt(totalPub)} MAD</span>
                  </div>
                </div>
              )}

              {/* Add form */}
              <div className="border border-dashed border-gray-300 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-600 flex items-center gap-1"><Plus size={12} /> Nouveau transfert</p>
                <input value={newTransfer.label} onChange={e => setNewTransfer(p => ({ ...p, label: e.target.value }))}
                  placeholder="Ex: Facebook Ads Juin" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                <input type="number" value={newTransfer.amount} onChange={e => setNewTransfer(p => ({ ...p, amount: e.target.value }))}
                  placeholder="Montant en MAD" min={0} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                <button onClick={addTransfer} disabled={!newTransfer.amount}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 disabled:opacity-40 transition">
                  <Plus size={14} /> Ajouter le transfert
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
