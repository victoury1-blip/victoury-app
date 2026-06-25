import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Plus, Printer, X, Check, FileText, Eye, ArrowLeft, ToggleLeft, ToggleRight, Trash2, RefreshCw } from 'lucide-react';
import { loadFactures, saveFactures, loadFacturesRemote, nextRef, ELIGIBLE_STATUSES, statusLabel } from '../data/factures';
import { supabase } from '../lib/supabase';
import { cloudGet, cloudSet } from '../lib/cloudSettings';

/* ─── Auto-fetch Ozone cities frais ─── */
async function fetchOzoneFrais(livreurId) {
  try {
    const res = await fetch('https://api.ozonexpress.ma/cities');
    const raw = await res.json();
    let arr;
    if (raw.CITIES && typeof raw.CITIES === 'object' && !Array.isArray(raw.CITIES)) arr = Object.values(raw.CITIES);
    else if (Array.isArray(raw)) arr = raw;
    else if (Array.isArray(raw.cities)) arr = raw.cities;
    else if (Array.isArray(raw.data)) arr = raw.data;
    else { const nested = Object.values(raw).find(v => typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 3); arr = nested ? Object.values(nested) : []; }
    if (!arr?.length) return [];
    const mapped = arr.map((c, i) => ({
      id: String(c.ID || c.id || c.city_id || i + 1),
      ville: c.NAME || c.name || c.city_name || c.CITY_NAME || '?',
      livre: parseFloat(c['DELIVERED-PRICE'] || c.delivered_price || c.tarif_livre || c.price || 35) || 35,
      annule: parseFloat(c['RETURNED-PRICE'] || c.returned_price || c.tarif_annule || 0) || 0,
      refuse: parseFloat(c['REFUSED-PRICE'] || c.refused_price || c.tarif_refuse || 0) || 0,
      change: parseFloat(c['CHANGED-PRICE'] || c.changed_price || c['DELIVERED-PRICE'] || c.price || 35) || 35,
    })).filter(c => c.ville !== '?');
    if (mapped.length) {
      const key = `frais_${livreurId}`;
      localStorage.setItem(key, JSON.stringify(mapped));
      cloudSet(key, mapped);
    }
    return mapped;
  } catch { return []; }
}

/* ─── helpers ─── */
function fmt(n) { return Number(n || 0).toFixed(2); }
function nowTs() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

const STATUT_STYLE = {
  en_attente: 'bg-blue-500 text-white',
  paye:       'bg-green-500 text-white',
  cloture:    'bg-gray-400 text-white',
};
const STATUT_LABEL = { en_attente: 'Ouvert', paye: 'Versé', cloture: 'Clôturé' };

/* ─── Facture Detail View ─── */
function FactureDetail({ facture, onBack, onUpdate, onDelete }) {
  const [recalculating, setRecalculating] = useState(false);

  async function recalculerFrais() {
    setRecalculating(true);
    try {
      let livreursList = JSON.parse(localStorage.getItem('livreurs') || '[]');
      if (!livreursList.length) {
        const remote = await cloudGet('livreurs');
        if (Array.isArray(remote) && remote.length) {
          livreursList = remote;
          localStorage.setItem('livreurs', JSON.stringify(remote));
        }
      }
      const fraisCache = {};
      await Promise.all(livreursList.map(async (l) => {
        const remote = await cloudGet(`frais_${l.id}`);
        if (Array.isArray(remote) && remote.length) {
          localStorage.setItem(`frais_${l.id}`, JSON.stringify(remote));
          fraisCache[l.id] = remote;
        } else {
          const local = JSON.parse(localStorage.getItem(`frais_${l.id}`) || '[]');
          if (local.length) { fraisCache[l.id] = local; return; }
          if (l.isOzone) {
            const oz = await fetchOzoneFrais(l.id);
            if (oz.length) { fraisCache[l.id] = oz; return; }
          }
          fraisCache[l.id] = [];
        }
      }));
      const updatedColis = facture.colis.map(c => {
        const auto = getLivreurFrais(facture.livreur, c.city, c.status, fraisCache, livreursList);
        return { ...c, fraisLivraison: auto !== null ? auto : c.fraisLivraison };
      });
      const totalLivre = updatedColis.filter(c => c.status === 'livre').reduce((s, c) => s + (c.prix || 0), 0);
      const totalFrais = updatedColis.reduce((s, c) => s + (c.fraisLivraison || 0), 0);
      onUpdate({ ...facture, colis: updatedColis, totalLivre, totalFrais, totalNet: totalLivre - totalFrais });
    } catch (e) { console.error('Recalcul failed:', e); }
    setRecalculating(false);
  }

  function toggleCloture() {
    const updated = { ...facture, locked: !facture.locked, statut: !facture.locked ? 'cloture' : 'en_attente' };
    onUpdate(updated);
  }
  function toggleVerse() {
    const updated = { ...facture, statut: facture.statut === 'paye' ? 'en_attente' : 'paye', datePaiement: facture.statut !== 'paye' ? nowTs() : null };
    onUpdate(updated);
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Facture {facture.ref}</h1>
          <p className="text-xs text-gray-500 mt-0.5">Gestion des factures des livreurs</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => printFacture(facture)} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">
            <Printer size={14} /> Télécharger PDF
          </button>
          <button onClick={onBack} className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
            <ArrowLeft size={14} /> Retour à la liste
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Top 3 boxes */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 text-lg">👤</div>
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Livreur</div>
              <div className="font-bold text-gray-800 mt-0.5">{facture.livreur || '—'}</div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-lg">💰</div>
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Net</div>
              <div className="font-bold text-gray-800 mt-0.5 text-lg">{fmt(facture.totalNet)} DH</div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-lg">📋</div>
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</div>
              <span className={`inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-bold ${STATUT_STYLE[facture.statut]}`}>
                {STATUT_LABEL[facture.statut]}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Informations */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-bold text-gray-700 mb-4 text-sm">Informations</h3>
            <div className="space-y-3 text-sm">
              {[
                ['Numéro de facture', facture.ref],
                ['Livreur', facture.livreur || '—'],
                ['Téléphone', facture.phone || '—'],
                ['Date de création', facture.dateCreation],
                ['Nombre de commandes', facture.colis.length],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-semibold text-gray-800">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Totaux */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-bold text-gray-700 mb-4 text-sm">Totaux</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Brut (CRBT)</span>
                <span className="font-semibold">{fmt(facture.totalLivre)} DH</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total Frais</span>
                <span className="font-semibold text-red-500">{fmt(facture.totalFrais)} DH</span>
              </div>
              <div className="flex justify-between border-t pt-3 mt-3">
                <span className="font-bold text-gray-700">Total Net</span>
                <span className="font-bold text-green-700 text-base">{fmt(facture.totalNet)} DH</span>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={recalculerFrais} disabled={recalculating}
                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-500 text-white text-xs font-semibold hover:bg-blue-600 disabled:opacity-50">
                <RefreshCw size={12} className={recalculating ? 'animate-spin' : ''} /> {recalculating ? '...' : 'Recalculer frais'}
              </button>
              <button onClick={toggleCloture} className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${facture.locked ? 'bg-gray-200 text-gray-600 hover:bg-gray-300' : 'bg-amber-500 text-white hover:bg-amber-600'}`}>
                {facture.locked ? 'Rouvrir' : 'Clôturer la facture'}
              </button>
              <button onClick={() => { if(window.confirm('Supprimer cette facture ?')) onDelete(facture.id); }}
                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600">
                <Trash2 size={12} /> Supprimer
              </button>
            </div>
          </div>
        </div>

        {/* Commandes associées */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50">
            <h3 className="font-bold text-gray-700 text-sm">Commandes associées</h3>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['ID','Client','Ville','Téléphone','Produit','Statut','Montant','Frais','Date'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {facture.colis.map((c, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-blue-600">{c.orderId}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-700">{c.recipient || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{c.city || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{c.phone || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600 max-w-[180px] truncate">{c.product || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        c.status === 'livre' ? 'bg-green-100 text-green-700' :
                        c.status === 'refuse' ? 'bg-red-100 text-red-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>{statusLabel(c.status)}</span>
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-gray-800">{fmt(c.prix)} DH</td>
                    <td className="px-4 py-2.5 text-red-500 text-xs">{fmt(c.fraisLivraison)} DH</td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">{c.date || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── PDF print ─── */
function printFacture(f) {
  const rows = f.colis.map(c => `
    <tr>
      <td>${c.orderId}</td>
      <td>${statusLabel(c.status)}</td>
      <td>${fmt(c.prix)} DH</td>
      <td>${fmt(c.fraisLivraison)} DH</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
  <title>${f.ref}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 32px; font-size: 13px; }
    h1 { font-size: 22px; color: #1e3a8a; margin-bottom: 4px; }
    .meta { color:#555; margin-bottom: 24px; font-size: 12px; }
    table { width:100%; border-collapse:collapse; margin-top:16px; }
    th { background:#1e3a8a; color:#fff; padding:8px 10px; text-align:left; font-size:11px; }
    td { padding:7px 10px; border-bottom:1px solid #e5e7eb; }
    tr:nth-child(even) td { background:#f8fafc; }
    .total-row td { font-weight:bold; background:#f1f5f9; }
    .summary { margin-top:24px; display:flex; gap:24px; }
    .summary div { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 18px; }
    .summary .lbl { font-size:11px; color:#6b7280; }
    .summary .val { font-size:18px; font-weight:bold; color:#1e293b; }
    .badge { display:inline-block; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:600; }
    @media print { button { display:none; } }
  </style></head><body>
  <h1>📄 Facture — ${f.ref}</h1>
  <div class="meta">
    Livreur: <strong>${f.livreur || '—'}</strong> &nbsp;|&nbsp;
    Date de création: <strong>${f.dateCreation}</strong> &nbsp;|&nbsp;
    Statut: <strong>${STATUT_LABEL[f.statut]}</strong>
    ${f.datePaiement ? ` &nbsp;|&nbsp; Date paiement: <strong>${f.datePaiement}</strong>` : ''}
  </div>
  <table>
    <thead><tr><th>Commande</th><th>Statut</th><th>Prix</th><th>Frais livraison</th></tr></thead>
    <tbody>${rows}
      <tr class="total-row">
        <td colspan="2">TOTAL (${f.colis.length} colis)</td>
        <td>${fmt(f.totalLivre)} DH</td>
        <td>${fmt(f.totalFrais)} DH</td>
      </tr>
    </tbody>
  </table>
  <div class="summary">
    <div><div class="lbl">Livré</div><div class="val">${f.colis.filter(c=>c.status==='livre').length}</div></div>
    <div><div class="lbl">Refusé</div><div class="val">${f.colis.filter(c=>c.status==='refuse').length}</div></div>
    <div><div class="lbl">Annulé</div><div class="val">${f.colis.filter(c=>c.status==='annule').length}</div></div>
    <div><div class="lbl">Montant net</div><div class="val" style="color:#16a34a">${fmt(f.totalNet)} DH</div></div>
  </div>
  <script>window.onload=()=>window.print();</script>
  </body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
}

/* ─── helpers: get delivery fee from fraisList (supports partial city match) ─── */
function getLivreurFraisFromList(fraisList, city, status) {
  if (!fraisList?.length || !city) return null;
  const cn = city.toLowerCase().trim();
  /* 1. Exact match */
  let row = fraisList.find(c => (c.ville || '').toLowerCase().trim() === cn);
  /* 2. Partial match (French includes order-city or vice versa) */
  if (!row) row = fraisList.find(c => {
    const vl = (c.ville || '').toLowerCase().trim();
    return vl && (vl.includes(cn) || cn.includes(vl));
  });
  if (!row) return null;
  if (status === 'livre')  return row.livre  ?? null;
  if (status === 'refuse') return row.refuse ?? null;
  if (status === 'annule') return row.annule ?? null;
  if (status === 'change') return row.change ?? null;
  return row.livre ?? null;
}

function getLivreurFrais(livreurName, city, status, fraisCache, livreursList) {
  try {
    const list = livreursList || JSON.parse(localStorage.getItem('livreurs') || '[]');
    const liv = list.find(l => l.nom === livreurName);
    if (!liv) return null;
    const fraisList = fraisCache?.[liv.id] || JSON.parse(localStorage.getItem(`frais_${liv.id}`) || '[]');
    return getLivreurFraisFromList(fraisList, city, status);
  } catch { return null; }
}

/* ─── New Facture Modal ─── */
function NewFactureModal({ orders, onClose, onCreated }) {
  const [livreur, setLivreur] = useState('');
  const [fraisDefault, setFraisDefault] = useState(0);
  const [selected, setSelected] = useState({});
  const [fraisCache, setFraisCache] = useState({});

  /* Load frais from cloud for all livreurs so city matching works even without localStorage */
  useEffect(() => {
    (async () => {
    let livreursList = JSON.parse(localStorage.getItem('livreurs') || '[]');
    if (!livreursList.length) {
      const remote = await cloudGet('livreurs');
      if (Array.isArray(remote) && remote.length) {
        livreursList = remote;
        localStorage.setItem('livreurs', JSON.stringify(remote));
      }
    }
    Promise.all(
      livreursList.map(async (l) => {
        const remote = await cloudGet(`frais_${l.id}`);
        if (Array.isArray(remote) && remote.length) {
          localStorage.setItem(`frais_${l.id}`, JSON.stringify(remote));
          return [l.id, remote];
        }
        const local = JSON.parse(localStorage.getItem(`frais_${l.id}`) || '[]');
        if (local.length) return [l.id, local];
        if (l.isOzone) {
          const ozoneFrais = await fetchOzoneFrais(l.id);
          if (ozoneFrais.length) return [l.id, ozoneFrais];
        }
        return [l.id, []];
      })
    ).then(entries => {
      const cache = Object.fromEntries(entries);
      setFraisCache(cache);
      /* Recalculate frais for already-selected orders once cache is ready */
      setSelected(prev => {
        if (!Object.keys(prev).length) return prev;
        const updated = { ...prev };
        for (const id of Object.keys(updated)) {
          const o = orders.find(x => x.id === id);
          if (!o) continue;
          const liv = o.recipient?.delivery || '';
          const auto = getLivreurFrais(liv, o.recipient?.city, o.status, cache);
          if (auto !== null) updated[id] = auto;
        }
        return updated;
      });
    });
    })();
  }, []);

  const eligible = useMemo(() => orders.filter(o =>
    ELIGIBLE_STATUSES.includes(o.status) && (livreur ? (o.recipient?.delivery || '') === livreur : true)
  ), [orders, livreur]);

  const livreurs = [...new Set(orders.map(o => o.recipient?.delivery).filter(Boolean))];

  function getFraisForOrder(o) {
    const auto = getLivreurFrais(o.recipient?.delivery || livreur, o.recipient?.city, o.status, fraisCache);
    return auto !== null ? auto : fraisDefault;
  }

  function toggleAll() {
    if (Object.keys(selected).length === eligible.length) {
      setSelected({});
    } else {
      const s = {};
      eligible.forEach(o => { s[o.id] = getFraisForOrder(o); });
      setSelected(s);
    }
  }

  function toggleOne(id) {
    setSelected(prev => {
      const n = { ...prev };
      if (n[id] !== undefined) { delete n[id]; } else {
        const o = eligible.find(x => x.id === id);
        n[id] = o ? getFraisForOrder(o) : fraisDefault;
      }
      return n;
    });
  }

  const selOrders = eligible.filter(o => selected[o.id] !== undefined);
  const totalLivre = selOrders.filter(o => o.status === 'livre').reduce((s, o) => s + (o.price || 0), 0);
  const totalFrais = selOrders.reduce((s, o) => s + (selected[o.id] || 0), 0);
  const totalNet = totalLivre - totalFrais;

  async function create() {
    if (!selOrders.length) return;
    const ref = await nextRef();
    const facture = {
      id: ref,
      ref,
      dateCreation: nowTs(),
      datePaiement: null,
      statut: 'en_attente',
      livreur: livreur || 'Manuel',
      colis: selOrders.map(o => ({
        orderId: o.id,
        status: o.status,
        prix: o.price || 0,
        fraisLivraison: selected[o.id] || 0,
        recipient: o.recipient?.name,
      })),
      totalLivre,
      totalFrais,
      totalNet,
      locked: false,
    };
    const list = [...loadFactures(), facture];
    saveFactures(list);
    onCreated(list);
    onClose();
  }

  const ic = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-full';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-gray-800 text-lg">Nouvelle facture</h2>
          <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Config */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Livreur</label>
              <select value={livreur} onChange={e => setLivreur(e.target.value)} className={ic}>
                <option value="">Tous les livreurs</option>
                {livreurs.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Frais livraison par défaut (DH)</label>
              <input type="number" value={fraisDefault} onChange={e => setFraisDefault(Number(e.target.value))} className={ic} />
            </div>
          </div>

          {/* Order list */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 flex items-center gap-3 border-b border-gray-200">
              <input type="checkbox"
                checked={Object.keys(selected).length === eligible.length && eligible.length > 0}
                onChange={toggleAll} className="w-4 h-4" />
              <span className="text-xs font-semibold text-gray-500 uppercase">
                {eligible.length} commandes éligibles ({Object.keys(selected).length} sélectionnées)
              </span>
            </div>
            {eligible.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">Aucune commande éligible</div>
            ) : (
              <div className="divide-y divide-gray-50 max-h-52 overflow-y-auto">
                {eligible.map(o => (
                  <div key={o.id} className={`flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 ${selected[o.id] !== undefined ? 'bg-blue-50/40' : ''}`}>
                    <input type="checkbox" checked={selected[o.id] !== undefined} onChange={() => toggleOne(o.id)} className="w-4 h-4" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-blue-700">{o.id}</div>
                      <div className="text-xs text-gray-600 truncate">{o.recipient?.name}</div>
                      {o.recipient?.city && <div className="text-xs text-gray-400">{o.recipient.city}</div>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
                      o.status === 'livre' ? 'bg-green-100 text-green-700 border-green-300' :
                      o.status === 'refuse' ? 'bg-red-100 text-red-700 border-red-300' :
                      'bg-gray-100 text-gray-600 border-gray-300'
                    }`}>{statusLabel(o.status)}</span>
                    <div className="font-bold text-gray-800 text-sm w-20 text-right">{fmt(o.price)} DH</div>
                    {selected[o.id] !== undefined && (() => {
                      const autoFrais = getLivreurFrais(o.recipient?.delivery || livreur, o.recipient?.city, o.status, fraisCache);
                      return (
                        <div className="flex items-center gap-1 w-32">
                          <span className="text-xs text-gray-400">Frais:</span>
                          <input type="number" value={selected[o.id]}
                            onChange={e => setSelected(prev => ({ ...prev, [o.id]: Number(e.target.value) }))}
                            className="border border-gray-200 rounded px-2 py-0.5 text-xs w-16 text-center" />
                          {autoFrais !== null && <span className="text-xs text-green-500" title="Frais auto-détecté">✓</span>}
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          {selOrders.length > 0 && (
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Livré', val: selOrders.filter(o=>o.status==='livre').length, unit: 'colis', color: 'text-green-700' },
                { label: 'Refusé/Annulé', val: selOrders.filter(o=>o.status!=='livre').length, unit: 'colis', color: 'text-red-600' },
                { label: 'Total brut', val: `${fmt(totalLivre)} DH`, color: 'text-gray-800' },
                { label: 'Net à recevoir', val: `${fmt(totalNet)} DH`, color: 'text-blue-700 font-bold' },
              ].map(item => (
                <div key={item.label} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <div className="text-xs text-gray-400">{item.label}</div>
                  <div className={`text-lg font-bold ${item.color}`}>{item.val} <span className="text-xs font-normal">{item.unit || ''}</span></div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
          <button onClick={create} disabled={!selOrders.length}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-40">
            Créer la facture ({selOrders.length} colis)
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main FacturesPage ─── */
export default function FacturesPage({ orders }) {
  const [factures, setFactures] = useState(() => loadFactures());
  const [newOpen, setNewOpen] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);

  useEffect(() => {
    loadFacturesRemote().then(remote => {
      if (remote && remote.length) {
        setFactures(prev => {
          // Merge: remote is source of truth, but keep any local-only factures
          const remoteMap = new Map(remote.map(f => [f.id, f]));
          const localOnly = prev.filter(f => !remoteMap.has(f.id));
          return [...remote, ...localOnly];
        });
      }
    });
    // Sync livreurs + frais from cloud for cross-device support
    cloudGet('livreurs').then(remote => {
      if (Array.isArray(remote) && remote.length) {
        localStorage.setItem('livreurs', JSON.stringify(remote));
        remote.forEach(l => {
          cloudGet(`frais_${l.id}`).then(frais => {
            if (Array.isArray(frais) && frais.length) localStorage.setItem(`frais_${l.id}`, JSON.stringify(frais));
          });
        });
      }
    });

    const channel = supabase
      .channel('settings-factures')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'settings',
        filter: 'key=eq.victoury_factures',
      }, (payload) => {
        const val = payload.new?.value;
        if (Array.isArray(val)) {
          setFactures(prev => {
            const remoteMap = new Map(val.map(f => [f.id, f]));
            const localOnly = prev.filter(f => !remoteMap.has(f.id));
            return [...val, ...localOnly];
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);
  const [detail, setDetail] = useState(null);
  const [filterLivreur, setFilterLivreur] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [notes, setNotes] = useState({});
  const autoGenRef = useRef(new Set());

  /* ── Auto-create facture when order status changes to eligible ── */
  useEffect(() => {
    (async () => {
      // Read current factures from state via functional update pattern
      let currentFactures;
      setFactures(prev => { currentFactures = prev; return prev; });

      const already = new Set(currentFactures.flatMap(f => f.colis.map(c => c.orderId)));
      const pending = orders.filter(o => ELIGIBLE_STATUSES.includes(o.status) && !already.has(o.id) && !autoGenRef.current.has(o.id));
      if (!pending.length) return;

      pending.forEach(o => autoGenRef.current.add(o.id));

      const fraisDefault = 0;
      const byLivreur = {};
      pending.forEach(o => {
        const lv = o.recipient?.delivery || 'Manuel';
        if (!byLivreur[lv]) byLivreur[lv] = [];
        byLivreur[lv].push(o);
      });

      let livreursList = JSON.parse(localStorage.getItem('livreurs') || '[]');
      if (!livreursList.length) {
        const remote = await cloudGet('livreurs');
        if (Array.isArray(remote) && remote.length) {
          livreursList = remote;
          localStorage.setItem('livreurs', JSON.stringify(remote));
        }
      }
      const fraisCache = {};
      await Promise.all(livreursList.map(async (l) => {
        const remote = await cloudGet(`frais_${l.id}`);
        if (Array.isArray(remote) && remote.length) {
          localStorage.setItem(`frais_${l.id}`, JSON.stringify(remote));
          fraisCache[l.id] = remote;
        } else {
          const local = JSON.parse(localStorage.getItem(`frais_${l.id}`) || '[]');
          if (local.length) { fraisCache[l.id] = local; return; }
          if (l.isOzone) {
            const oz = await fetchOzoneFrais(l.id);
            if (oz.length) { fraisCache[l.id] = oz; return; }
          }
          fraisCache[l.id] = [];
        }
      }));

      const newFactures = [];
      for (const [lv, cols] of Object.entries(byLivreur)) {
        const ref = await nextRef();
        const livres = cols.filter(o => o.status === 'livre');
        const totalLivre = livres.reduce((s, o) => s + (o.price || 0), 0);
        const totalFrais = cols.reduce((s, o) => {
          const auto = getLivreurFrais(lv, o.recipient?.city, o.status, fraisCache, livreursList);
          return s + (auto !== null ? auto : fraisDefault);
        }, 0);
        const totalNet = totalLivre - totalFrais;
        newFactures.push({
          id: ref, ref,
          dateCreation: nowTs(),
          datePaiement: null,
          statut: 'en_attente',
          livreur: lv,
          colis: cols.map(o => {
            const auto = getLivreurFrais(lv, o.recipient?.city, o.status, fraisCache, livreursList);
            return {
              orderId: o.id,
              status: o.status,
              prix: o.price || 0,
              fraisLivraison: auto !== null ? auto : fraisDefault,
              recipient: o.recipient?.name,
              city: o.recipient?.city,
              phone: o.recipient?.phone,
              product: o.product?.name || '',
              date: o.dateUpdated || o.dateAdded || '',
            };
          }),
          totalLivre, totalFrais, totalNet,
          locked: false,
        });
      }
      if (newFactures.length) {
        setFactures(prev => {
          const list = [...prev, ...newFactures];
          saveFactures(list);
          return list;
        });
      }
    })();
  }, [orders]);

  const livreurs = [...new Set(factures.map(f => f.livreur).filter(Boolean))];

  const filtered = useMemo(() => factures.filter(f => {
    const matchL = !filterLivreur || f.livreur === filterLivreur;
    const matchS = !filterStatut || f.statut === filterStatut;
    return matchL && matchS;
  }), [factures, filterLivreur, filterStatut]);

  function updateFacture(updated) {
    setFactures(prev => {
      const list = prev.map(f => f.id === updated.id ? updated : f);
      saveFactures(list);
      return list;
    });
    if (detail?.id === updated.id) setDetail(updated);
  }

  function toggleCloture(f) {
    updateFacture({ ...f, locked: !f.locked, statut: !f.locked ? 'cloture' : 'en_attente' });
  }
  function toggleVerse(f) {
    updateFacture({ ...f, statut: f.statut === 'paye' ? 'en_attente' : 'paye', datePaiement: f.statut !== 'paye' ? nowTs() : null });
  }
  function del(id) {
    if (!window.confirm('Supprimer cette facture ?')) return;
    setFactures(prev => {
      const list = prev.filter(f => f.id !== id);
      saveFactures(list);
      return list;
    });
    if (detail?.id === id) setDetail(null);
  }
  function reset() { setFilterLivreur(''); setFilterStatut(''); }

  /* ── Auto-generate factures for eligible unprocessed orders ── */
  async function autoGenerate() {
    let currentFactures;
    setFactures(prev => { currentFactures = prev; return prev; });

    const already = new Set(currentFactures.flatMap(f => f.colis.map(c => c.orderId)));
    const pending = orders.filter(o => ELIGIBLE_STATUSES.includes(o.status) && !already.has(o.id));
    if (!pending.length) { alert('Aucune commande éligible à facturer.'); return; }
    setAutoGenerating(true);

    const byLivreur = {};
    pending.forEach(o => {
      const lv = o.recipient?.delivery || 'Manuel';
      if (!byLivreur[lv]) byLivreur[lv] = [];
      byLivreur[lv].push(o);
    });

    let livreursList = JSON.parse(localStorage.getItem('livreurs') || '[]');
    if (!livreursList.length) {
      const remote = await cloudGet('livreurs');
      if (Array.isArray(remote) && remote.length) {
        livreursList = remote;
        localStorage.setItem('livreurs', JSON.stringify(remote));
      }
    }
    const fraisCache = {};
    await Promise.all(livreursList.map(async (l) => {
      const remote = await cloudGet(`frais_${l.id}`);
      if (Array.isArray(remote) && remote.length) {
        localStorage.setItem(`frais_${l.id}`, JSON.stringify(remote));
        fraisCache[l.id] = remote;
      } else {
        const local = JSON.parse(localStorage.getItem(`frais_${l.id}`) || '[]');
        if (local.length) { fraisCache[l.id] = local; return; }
        if (l.isOzone) {
          const oz = await fetchOzoneFrais(l.id);
          if (oz.length) { fraisCache[l.id] = oz; return; }
        }
        fraisCache[l.id] = [];
      }
    }));

    const newFactures = [];
    for (const [lv, cols] of Object.entries(byLivreur)) {
      const ref = await nextRef();
      const livres = cols.filter(o => o.status === 'livre');
      const totalLivre = livres.reduce((s, o) => s + (o.price || 0), 0);
      const totalFrais = cols.reduce((s, o) => {
        const auto = getLivreurFrais(lv, o.recipient?.city, o.status, fraisCache, livreursList);
        return s + (auto !== null ? auto : 0);
      }, 0);
      const totalNet = totalLivre - totalFrais;
      newFactures.push({
        id: ref, ref,
        dateCreation: nowTs(),
        datePaiement: null,
        statut: 'en_attente',
        livreur: lv,
        colis: cols.map(o => {
          const auto = getLivreurFrais(lv, o.recipient?.city, o.status, fraisCache, livreursList);
          return {
            orderId: o.id,
            status: o.status,
            prix: o.price || 0,
            fraisLivraison: auto !== null ? auto : 0,
            recipient: o.recipient?.name,
            city: o.recipient?.city,
            phone: o.recipient?.phone,
            product: o.product?.name || '',
            date: o.dateUpdated || o.dateAdded || '',
          };
        }),
        totalLivre, totalFrais, totalNet,
        locked: false,
      });
    }
    setFactures(prev => {
      const list = [...prev, ...newFactures];
      saveFactures(list);
      return list;
    });
    setAutoGenerating(false);
  }

  /* Count pending orders not in any facture */
  const pendingCount = useMemo(() => {
    const already = new Set(factures.flatMap(f => f.colis.map(c => c.orderId)));
    return orders.filter(o => ELIGIBLE_STATUSES.includes(o.status) && !already.has(o.id)).length;
  }, [factures, orders]);

  const selCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300';

  /* ── Detail view ── */
  if (detail) {
    const current = factures.find(f => f.id === detail.id) || detail;
    return (
      <FactureDetail
        facture={current}
        onBack={() => setDetail(null)}
        onUpdate={updateFacture}
        onDelete={(id) => { del(id); setDetail(null); }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Liste des Factures</h1>
            <p className="text-xs text-gray-500 mt-0.5">Gestion des factures des livreurs</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setNewOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">
              <Plus size={14} /> Nouvelle facture
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Livreur :</label>
            <select value={filterLivreur} onChange={e => setFilterLivreur(e.target.value)} className={selCls}>
              <option value="">Tous</option>
              {livreurs.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Statut :</label>
            <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} className={selCls}>
              <option value="">Tous</option>
              <option value="en_attente">Ouvert</option>
              <option value="paye">Versé</option>
              <option value="cloture">Clôturé</option>
            </select>
          </div>
          <div className="flex gap-2 ml-2">
            <button className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-semibold hover:bg-gray-900">
              Filtrer
            </button>
            <button onClick={reset} className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
              <RefreshCw size={13} /> Réinitialiser
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-white border-b border-gray-200 sticky top-0 z-10">
            <tr>
              {['Numéro','Livreur','Date création','Statut','Nb. com.','Total Brut','Total Frais','Total Net','Clôturé','Versé','Note','Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap border-b border-gray-100">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={12} className="py-16 text-center text-gray-400">Aucune facture</td></tr>
            )}
            {filtered.map(f => (
              <tr key={f.id} className="bg-white border-b border-gray-100 hover:bg-gray-50 transition">
                {/* Numéro */}
                <td className="px-4 py-3">
                  <span className="font-mono text-xs font-bold text-gray-700">{f.ref}</span>
                </td>
                {/* Livreur */}
                <td className="px-4 py-3 text-sm text-gray-700">{f.livreur || '—'}</td>
                {/* Date */}
                <td className="px-4 py-3 text-xs text-gray-500">{f.dateCreation}</td>
                {/* Statut */}
                <td className="px-4 py-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUT_STYLE[f.statut]}`}>
                    {STATUT_LABEL[f.statut]}
                  </span>
                </td>
                {/* Nb. com. */}
                <td className="px-4 py-3 font-bold text-gray-800 text-center">{f.colis.length}</td>
                {/* Total Brut */}
                <td className="px-4 py-3 text-sm text-gray-700">{fmt(f.totalLivre)} DH</td>
                {/* Total Frais */}
                <td className="px-4 py-3 text-sm text-red-500">{fmt(f.totalFrais)} DH</td>
                {/* Total Net */}
                <td className="px-4 py-3 font-bold text-green-700">{fmt(f.totalNet)} DH</td>
                {/* Clôturé toggle */}
                <td className="px-4 py-3">
                  <button onClick={() => toggleCloture(f)} className="focus:outline-none">
                    {f.locked
                      ? <div className="w-10 h-5 bg-blue-500 rounded-full flex items-center justify-end px-0.5"><div className="w-4 h-4 bg-white rounded-full shadow" /></div>
                      : <div className="w-10 h-5 bg-gray-300 rounded-full flex items-center px-0.5"><div className="w-4 h-4 bg-white rounded-full shadow" /></div>}
                  </button>
                </td>
                {/* Versé toggle */}
                <td className="px-4 py-3">
                  <button onClick={() => toggleVerse(f)} className="focus:outline-none">
                    {f.statut === 'paye'
                      ? <div className="w-10 h-5 bg-green-500 rounded-full flex items-center justify-end px-0.5"><div className="w-4 h-4 bg-white rounded-full shadow" /></div>
                      : <div className="w-10 h-5 bg-gray-300 rounded-full flex items-center px-0.5"><div className="w-4 h-4 bg-white rounded-full shadow" /></div>}
                  </button>
                </td>
                {/* Note */}
                <td className="px-4 py-3">
                  <input
                    value={notes[f.id] ?? (f.note || '')}
                    onChange={e => setNotes(p => ({ ...p, [f.id]: e.target.value }))}
                    onBlur={e => { updateFacture({ ...f, note: e.target.value }); }}
                    placeholder="+ Ajouter note"
                    className="text-xs border border-gray-200 rounded px-2 py-1 w-32 focus:outline-none focus:ring-1 focus:ring-blue-300 text-gray-600 placeholder-gray-400"
                  />
                </td>
                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setDetail(f)} title="Voir détail"
                      className="p-1.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100"><Eye size={13} /></button>
                    <button onClick={() => printFacture(f)} title="PDF"
                      className="p-1.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200"><Printer size={13} /></button>
                    {!f.locked && (
                      <button onClick={() => del(f.id)} title="Supprimer"
                        className="p-1.5 rounded bg-red-50 text-red-500 hover:bg-red-100"><Trash2 size={13} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {newOpen && (
        <NewFactureModal orders={orders.filter(o => !factures.some(f => f.colis.some(c => c.orderId === o.id)))} onClose={() => setNewOpen(false)} onCreated={setFactures} />
      )}
    </div>
  );
}
