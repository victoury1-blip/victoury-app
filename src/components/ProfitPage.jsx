import React, { useState, useMemo, useEffect } from 'react';
import { TrendingUp, RefreshCw, ShoppingBag, Percent, Truck, DollarSign, Download, Plus, Trash2, Receipt, Package } from 'lucide-react';
import { loadProducts } from '../data/products';
import { loadFactures } from '../data/factures';
import { supabase } from '../lib/supabase';
import { cloudGet } from '../lib/cloudSettings';

function fmt(n) { return Number(n || 0).toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function pct(val, total) { return total ? ((val / total) * 100).toFixed(1) : '0.0'; }

const EXPENSE_CATS = [
  { value: 'facebook', label: 'Facebook Ads', color: 'text-blue-600', bg: 'bg-blue-50' },
  { value: 'tiktok', label: 'TikTok Ads', color: 'text-pink-600', bg: 'bg-pink-50' },
  { value: 'livraison', label: 'Frais Livraison extra', color: 'text-orange-600', bg: 'bg-orange-50' },
  { value: 'autres', label: 'Autres dépenses', color: 'text-gray-600', bg: 'bg-gray-100' },
];

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
  const [applied,  setApplied]  = useState({ dateFrom: firstDay, dateTo: lastDay });

  const [adTransfers, setAdTransfers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ad_transfers') || '[]'); } catch { return []; }
  });
  const [newTransfer, setNewTransfer] = useState({ label: '', amount: '', category: 'facebook' });
  const [showAdModal, setShowAdModal] = useState(false);

  const [factures, setFactures] = useState(() => loadFactures());

  useEffect(() => {
    supabase.from('settings').select('value').eq('key', 'ad_transfers').single().then(({ data }) => {
      if (Array.isArray(data?.value) && data.value.length) {
        setAdTransfers(data.value);
        localStorage.setItem('ad_transfers', JSON.stringify(data.value));
      }
    });
    supabase.from('settings').select('value').eq('key', 'victoury_factures').single().then(({ data }) => {
      if (Array.isArray(data?.value)) setFactures(data.value);
    });
  }, []);

  function saveAdTransfers(list) {
    setAdTransfers(list);
    localStorage.setItem('ad_transfers', JSON.stringify(list));
    supabase.from('settings').upsert(
      { key: 'ad_transfers', value: list, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    ).then(() => {}).catch(e => console.error('Save ad_transfers failed:', e));
  }

  function addTransfer() {
    if (!newTransfer.amount) return;
    saveAdTransfers([...adTransfers, {
      id: Date.now(),
      label: newTransfer.label || EXPENSE_CATS.find(c => c.value === newTransfer.category)?.label || 'Dépense',
      amount: parseFloat(newTransfer.amount) || 0,
      category: newTransfer.category || 'facebook',
      date: new Date().toISOString().slice(0, 10),
    }]);
    setNewTransfer({ label: '', amount: '', category: 'facebook' });
  }

  function removeTransfer(id) { saveAdTransfers(adTransfers.filter(t => t.id !== id)); }

  function apply() { setApplied({ dateFrom, dateTo }); }
  function reset() {
    setDateFrom(firstDay); setDateTo(lastDay);
    setApplied({ dateFrom: firstDay, dateTo: lastDay });
  }

  const stockProducts = useMemo(() => loadProducts(), []);

  // Get all colis from factures, within the period
  const allFactureColis = useMemo(() => {
    const colis = [];
    for (const f of factures) {
      // Parse facture date (DD/MM/YYYY HH:MM format)
      let fDate = '';
      if (f.dateCreation) {
        const parts = f.dateCreation.split(' ')[0].split('/');
        if (parts.length === 3) fDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      if (fDate && (fDate < applied.dateFrom || fDate > applied.dateTo)) continue;
      for (const c of (f.colis || [])) {
        colis.push({ ...c, factureRef: f.ref, factureId: f.id, livreur: f.livreur, factureDateCreation: f.dateCreation });
      }
    }
    return colis;
  }, [factures, applied]);

  const livresColis = allFactureColis.filter(c => c.status === 'livre');
  const refuseColis = allFactureColis.filter(c => c.status === 'refuse');
  const tableColis = allFactureColis.filter(c => c.status === 'livre' || c.status === 'refuse');

  // Match each colis to its order for product cost calculation
  const orderMap = useMemo(() => new Map(orders.map(o => [o.id, o])), [orders]);

  function getProductCost(colis) {
    const order = orderMap.get(colis.orderId);
    if (!order) return 0;
    const prods = order.products?.length ? order.products : [order.product];
    let cost = 0;
    for (const p of prods) {
      if (!p?.name) continue;
      const pn = (p.name || '').trim().toLowerCase();
      const sp = stockProducts.find(s => (s.name || '').trim().toLowerCase() === pn)
        || stockProducts.find(s => pn.includes((s.name || '').trim().toLowerCase()) || (s.name || '').trim().toLowerCase().includes(pn));
      if (sp && sp.prixAchat) {
        cost += (parseFloat(sp.prixAchat) || 0) * (p.qty || 1);
      }
    }
    return cost;
  }

  // Calculations
  const ca = livresColis.reduce((s, c) => s + (c.prix || 0), 0);
  const coutAchat = livresColis.reduce((s, c) => s + getProductCost(c), 0);
  const fraisLiv = allFactureColis.reduce((s, c) => s + (c.fraisLivraison || 0), 0);
  const sousTotal = ca - coutAchat - fraisLiv;
  const totalPub = adTransfers.reduce((s, t) => s + (t.amount || 0), 0);
  const profitNet = sousTotal - totalPub;

  const totalRefuse = allFactureColis.filter(c => c.status === 'refuse').length;
  const totalLivre = livresColis.length;

  const selCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300';

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-auto">
      {/* Hero */}
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
        <div className="flex flex-wrap gap-2">
          <button onClick={apply} className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-semibold hover:bg-gray-900">Filtrer</button>
          <button onClick={reset} className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
            <RefreshCw size={13} /> Réinitialiser
          </button>
          <button onClick={() => {
            const rows = [['Facture','ID Colis','Client','Ville','Statut','Prix Vente','Coût Achat','Frais Liv.','Marge'].join(',')];
            tableColis.forEach(c => {
              const isR = c.status === 'refuse';
              const pa = isR ? 0 : getProductCost(c); const fl = c.fraisLivraison||0;
              const m = isR ? -fl : (c.prix||0) - pa - fl;
              rows.push([c.factureRef, c.orderId, c.recipient||'', c.city||'', isR?'Refusé':'Livré', isR?0:c.prix||0, pa.toFixed(2), fl, m.toFixed(2)].join(','));
            });
            rows.push('');
            EXPENSE_CATS.forEach(cat => {
              const t = adTransfers.filter(x => (x.category || 'facebook') === cat.value).reduce((s, x) => s + (x.amount || 0), 0);
              if (t) rows.push(`${cat.label},${t.toFixed(2)}`);
            });
            rows.push(`Total Dépenses,${totalPub.toFixed(2)}`); rows.push(`Profit Net,${profitNet.toFixed(2)}`);
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
            subtitle={`${totalLivre} livrée${totalLivre > 1 ? 's' : ''} | ${totalRefuse} refusée${totalRefuse > 1 ? 's' : ''}`}
            color={{ border: 'border-blue-500', icon: 'text-blue-500', text: 'text-blue-700', bar: 'bg-blue-500' }} />
          <KpiCard label="Coût d'Achat" value={coutAchat} icon={Package}
            subtitle={`${pct(coutAchat, ca)}% du CA`}
            color={{ border: 'border-red-400', icon: 'text-red-500', text: 'text-red-600', bar: 'bg-red-400' }} />
          <KpiCard label="Frais Livraison" value={fraisLiv} icon={Truck}
            subtitle={`${allFactureColis.length} colis au total`}
            color={{ border: 'border-orange-400', icon: 'text-orange-500', text: 'text-orange-600', bar: 'bg-orange-400' }} />
          <KpiCard label="Profit Net" value={profitNet} icon={DollarSign}
            subtitle={`${pct(profitNet, ca)}% du CA (après pub)`} progress={Math.max(0, parseFloat(pct(profitNet, ca)))}
            color={{ border: 'border-teal-500', icon: 'text-teal-500', text: profitNet >= 0 ? 'text-teal-700' : 'text-red-600', bar: 'bg-teal-500' }} />
        </div>

        {/* Formula breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-bold text-gray-700 mb-4 text-sm">Détail du calcul</h2>

          {/* Step 1: CA - Achat - Livraison = Sous-total */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-center text-center">
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="text-[10px] font-semibold text-gray-500 uppercase">Prix de vente</div>
              <div className="text-lg font-black text-blue-700">{fmt(ca)}</div>
            </div>
            <div className="text-gray-400 font-bold text-xl hidden sm:flex items-center justify-center">−</div>
            <div className="bg-red-50 rounded-xl p-4">
              <div className="text-[10px] font-semibold text-gray-500 uppercase">Coût d'achat</div>
              <div className="text-lg font-black text-red-600">{fmt(coutAchat)}</div>
            </div>
            <div className="text-gray-400 font-bold text-xl hidden sm:flex items-center justify-center">−</div>
            <div className="bg-orange-50 rounded-xl p-4">
              <div className="text-[10px] font-semibold text-gray-500 uppercase">Frais livraison</div>
              <div className="text-lg font-black text-orange-600">{fmt(fraisLiv)}</div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 my-4 text-sm text-gray-500">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="font-bold">= Sous-total: <span className={sousTotal >= 0 ? 'text-green-700' : 'text-red-600'}>{fmt(sousTotal)} MAD</span></span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          {/* Step 2: Sous-total - Pub = Profit */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center text-center">
            <div className="bg-green-50 rounded-xl p-4">
              <div className="text-[10px] font-semibold text-gray-500 uppercase">Sous-total</div>
              <div className="text-lg font-black text-green-700">{fmt(sousTotal)}</div>
            </div>
            <div className="text-gray-400 font-bold text-xl hidden sm:flex items-center justify-center">−</div>
            <div className="bg-purple-50 rounded-xl p-4">
              <div className="text-[10px] font-semibold text-gray-500 uppercase">Total Dépenses</div>
              <div className="text-lg font-black text-purple-600">{fmt(totalPub)}</div>
              <div className="flex flex-wrap justify-center gap-1 mt-2">
                {EXPENSE_CATS.map(cat => {
                  const t = adTransfers.filter(x => (x.category || 'facebook') === cat.value).reduce((s, x) => s + (x.amount || 0), 0);
                  if (!t) return null;
                  return <span key={cat.value} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${cat.bg} ${cat.color}`}>{cat.label}: {fmt(t)}</span>;
                })}
              </div>
              <button onClick={() => setShowAdModal(true)} className="text-[10px] text-purple-600 hover:underline mt-2">Gérer les dépenses →</button>
            </div>
          </div>

          {/* Result */}
          <div className="mt-4 bg-gradient-to-r from-teal-50 to-green-50 rounded-xl p-5 text-center border border-teal-200">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Profit Net Final</div>
            <div className={`text-3xl font-black ${profitNet >= 0 ? 'text-teal-700' : 'text-red-600'}`}>{fmt(profitNet)} <span className="text-sm font-semibold">MAD</span></div>
            <div className="text-xs text-gray-500 mt-1">{pct(profitNet, ca)}% du chiffre d'affaires</div>
          </div>
        </div>

        {/* Info about cost source */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
          💡 <strong>Coût d'achat :</strong> calculé depuis le <strong>prix d'achat</strong> dans Stock (pour chaque produit × quantité).
        </div>

        {/* Orders table from factures */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
            <h2 className="font-bold text-gray-700 text-sm">Commandes des factures ({livresColis.length} livrées · {refuseColis.length} refusées)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Facture','ID Colis','Client','Ville','Statut','Produit','Prix Vente','Coût Achat','Frais Liv.','Marge'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tableColis.length === 0 && (
                  <tr><td colSpan={10} className="py-10 text-center text-gray-400 text-sm">Aucune commande dans les factures de cette période</td></tr>
                )}
                {tableColis.map((c, i) => {
                  const isRefuse = c.status === 'refuse';
                  const pv = c.prix || 0;
                  const pa = isRefuse ? 0 : getProductCost(c);
                  const fl = c.fraisLivraison || 0;
                  const marge = isRefuse ? -(fl) : pv - pa - fl;
                  const order = orderMap.get(c.orderId);
                  const prodName = c.product || order?.product?.name || '—';
                  return (
                    <tr key={`${c.orderId}-${i}`} className={`hover:bg-gray-50 ${isRefuse ? 'bg-red-50/50' : ''}`}>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{c.factureRef}</td>
                      <td className="px-4 py-2.5 font-mono text-xs font-bold text-blue-600">{c.orderId}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-700">{c.recipient || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{c.city || order?.recipient?.city || '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isRefuse ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                          {isRefuse ? 'Refusé' : 'Livré'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-600 max-w-[150px] truncate">
                        {prodName}
                        {order?.products?.length > 1 && <span className="text-[10px] text-gray-400 ml-1">(+{order.products.length - 1})</span>}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-gray-800">{isRefuse ? '—' : fmt(pv)}</td>
                      <td className="px-4 py-2.5 text-red-500 text-xs font-semibold">{isRefuse ? '—' : fmt(pa)}</td>
                      <td className="px-4 py-2.5 text-orange-500 text-xs font-semibold">{fmt(fl)}</td>
                      <td className={`px-4 py-2.5 font-bold text-xs ${marge >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(marge)}</td>
                    </tr>
                  );
                })}
              </tbody>
              {tableColis.length > 0 && (
                <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                  <tr>
                    <td colSpan={6} className="px-4 py-3 text-xs font-bold text-gray-600">TOTAL ({livresColis.length} livrées · {refuseColis.length} refusées)</td>
                    <td className="px-4 py-3 font-black text-gray-800">{fmt(ca)}</td>
                    <td className="px-4 py-3 font-bold text-red-500">{fmt(coutAchat)}</td>
                    <td className="px-4 py-3 font-bold text-orange-500">{fmt(fraisLiv)}</td>
                    <td className={`px-4 py-3 font-black ${sousTotal >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(sousTotal)}</td>
                  </tr>
                  <tr className="border-t border-gray-300">
                    <td colSpan={9} className="px-4 py-2 text-xs font-bold text-gray-500 text-right">Dépenses :</td>
                    <td className="px-4 py-2 font-bold text-purple-600 text-xs">−{fmt(totalPub)}</td>
                  </tr>
                  <tr className="bg-teal-50">
                    <td colSpan={9} className="px-4 py-3 text-sm font-black text-gray-700 text-right">PROFIT NET :</td>
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
              <h2 className="text-lg font-bold text-gray-800">Gestion des dépenses</h2>
              <button onClick={() => setShowAdModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 text-xl">&times;</button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-500">Ajoutez vos dépenses par catégorie. Le total sera déduit du sous-total pour calculer le profit net.</p>

              {EXPENSE_CATS.map(cat => {
                const items = adTransfers.filter(t => (t.category || 'facebook') === cat.value);
                if (!items.length) return null;
                const catTotal = items.reduce((s, t) => s + (t.amount || 0), 0);
                return (
                  <div key={cat.value}>
                    <div className={`text-xs font-bold ${cat.color} mb-1`}>{cat.label}</div>
                    <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                      {items.map(t => (
                        <div key={t.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50">
                          <div>
                            <div className="text-sm font-semibold text-gray-800">{t.label}</div>
                            <div className="text-xs text-gray-400">{t.date}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-sm font-black ${cat.color}`}>{fmt(t.amount)} MAD</span>
                            <button onClick={() => removeTransfer(t.id)} className="p-1 rounded bg-red-50 text-red-500 hover:bg-red-100">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className={`px-4 py-2 ${cat.bg} flex items-center justify-between`}>
                        <span className="text-xs font-bold text-gray-600">Sous-total</span>
                        <span className={`font-black ${cat.color}`}>{fmt(catTotal)} MAD</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {adTransfers.length > 0 && (
                <div className="px-4 py-2.5 bg-purple-50 rounded-xl flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-600">TOTAL DÉPENSES</span>
                  <span className="font-black text-purple-700">{fmt(totalPub)} MAD</span>
                </div>
              )}

              <div className="border border-dashed border-gray-300 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-600 flex items-center gap-1"><Plus size={12} /> Nouvelle dépense</p>
                <select value={newTransfer.category} onChange={e => setNewTransfer(p => ({ ...p, category: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300">
                  {EXPENSE_CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <input value={newTransfer.label} onChange={e => setNewTransfer(p => ({ ...p, label: e.target.value }))}
                  placeholder="Description (ex: Facebook Ads Juin)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                <input type="number" value={newTransfer.amount} onChange={e => setNewTransfer(p => ({ ...p, amount: e.target.value }))}
                  placeholder="Montant en MAD" min={0} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                <button onClick={addTransfer} disabled={!newTransfer.amount}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 disabled:opacity-40 transition">
                  <Plus size={14} /> Ajouter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
