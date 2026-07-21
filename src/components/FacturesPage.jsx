import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Printer, X, Eye, ArrowLeft, Trash2, RefreshCw } from 'lucide-react';
import { loadFactures, saveFactures, loadFacturesRemote, nextRef, ELIGIBLE_STATUSES, statusLabel } from '../data/factures';
import { supabase } from '../lib/supabase';
import { cloudGet, cloudSet } from '../lib/cloudSettings';
import { useToast } from './Toast';

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
  const toast = useToast();
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
    if (facture.statut === 'paye') {
      onUpdate({ ...facture, statut: 'en_attente', locked: false, datePaiement: null });
    } else {
      onUpdate({ ...facture, statut: 'paye', locked: true, datePaiement: nowTs() });
    }
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
          <button onClick={() => printFacture(facture, toast)} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">
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
              <button onClick={() => onDelete(facture.id)}
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
function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
// Logo VICTOURY pour la facture : image configurée dans les Paramètres si présente,
// sinon un wordmark vectoriel (SVG) — un vrai « visuel », net à l'impression.
function factureLogoHtml() {
  try {
    const cfg = JSON.parse(localStorage.getItem('victoury_app_config') || '{}');
    if (cfg.appLogo) return `<img src="${cfg.appLogo}" alt="VICTOURY" style="height:70px;object-fit:contain;display:block" />`;
  } catch {}
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='52' viewBox='0 0 300 52'><text x='0' y='40' font-family='Georgia, "Times New Roman", serif' font-size='46' font-weight='700' letter-spacing='6' fill='#000'>VICTOURY</text></svg>`;
  return `<img src="data:image/svg+xml;utf8,${encodeURIComponent(svg)}" alt="VICTOURY" style="height:56px;display:block" />`;
}

function printFacture(f, toast) {
  const rows = f.colis.map((c, i) => {
    const net = (c.status === 'livre' ? (c.prix || 0) : 0) - (c.fraisLivraison || 0);
    return `
    <tr>
      <td class="c">${i + 1}</td>
      <td><b>${esc(c.orderId)}</b>${c.phone ? `<div class="ph">${esc(c.phone)}</div>` : ''}</td>
      <td>${esc(c.recipient || '—')}</td>
      <td>${esc(c.city || '—')}</td>
      <td class="c">${esc(statusLabel(c.status))}</td>
      <td class="r">${fmt(c.prix)} DH</td>
      <td class="r">${fmt(c.fraisLivraison)} DH</td>
      <td class="r"><b>${fmt(net)} DH</b></td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
  <title>${f.ref}</title>
  <style>
    * { box-sizing: border-box; }
    @page { size: A4 portrait; margin: 14mm; }
    html, body { background:#fff; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color:#000; margin:0; }
    /* Conteneur au format A4 : centré à l'écran, plein cadre à l'impression. */
    .sheet { width: 190mm; max-width: 100%; margin: 12px auto; padding: 10mm; background:#fff; }
    @media print { .sheet { width:auto; margin:0; padding:0; box-shadow:none; } }
    @media screen { .sheet { box-shadow: 0 2px 14px rgba(0,0,0,.12); } }
    table { page-break-inside:auto; }
    tr { page-break-inside:avoid; page-break-after:auto; }
    thead { display:table-header-group; }
    .head { display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #000; padding-bottom:16px; }
    .brand .sub { font-size:11px; color:#000; margin-top:4px; }
    .company { text-align:left; font-size:11.5px; line-height:1.8; color:#000; }
    .company .cn { font-size:15px; font-weight:800; margin-bottom:3px; }
    .invbox { text-align:right; font-size:12px; line-height:1.7; color:#000; }
    .invbox .ref { font-size:15px; font-weight:800; color:#000; }
    .parties { display:flex; gap:16px; margin:18px 0; }
    .party { flex:1; border:1px solid #000; padding:10px 14px; font-size:11.5px; line-height:1.7; }
    .party .t { font-size:10px; text-transform:uppercase; letter-spacing:.5px; color:#000; font-weight:700; margin-bottom:3px; }
    table { width:100%; border-collapse:collapse; margin-top:6px; }
    th { background:#fff; color:#000; padding:8px 9px; text-align:left; font-size:10.5px; text-transform:uppercase; letter-spacing:.3px; border:1px solid #000; }
    td { padding:8px 9px; border:1px solid #000; font-size:11.5px; color:#000; }
    td.c { text-align:center; } td.r { text-align:right; }
    .ph { font-size:10px; color:#000; }
    .totbox { margin-top:18px; margin-left:auto; width:60%; border:1px solid #000; border-collapse:collapse; }
    .totbox .row { display:flex; justify-content:space-between; padding:8px 14px; font-size:12px; border-bottom:1px solid #000; color:#000; }
    .totbox .row.net { font-weight:800; font-size:14px; border-bottom:none; }
    .footer { margin-top:26px; text-align:center; color:#000; font-size:11px; }
    .footer .thanks { font-weight:700; color:#000; margin-top:6px; }
  </style></head><body>
  <div class="sheet">
  <div class="head">
    <div class="brand">
      ${factureLogoHtml()}
    </div>
    <div class="company">
      <div class="cn">VICTOURY</div>
      <div>Adresse : Casablanca</div>
      <div>Téléphone : 0660003913</div>
      <div>Email : victoury1@gmail.com</div>
      <div>Web site : victoury-maroc.com</div>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <div class="t">Facture</div>
      <div class="ref" style="font-size:15px;font-weight:800">${esc(f.ref)}</div>
      <div>Date : <b>${esc(f.dateCreation)}</b></div>
      <div>Colis : <b>${f.colis.length}</b> · Statut : <b>${esc(STATUT_LABEL[f.statut] || f.statut || '')}</b></div>
      ${f.datePaiement ? `<div>Payée le : <b>${esc(f.datePaiement)}</b></div>` : ''}
    </div>
    <div class="party">
      <div class="t">Livreur</div>
      <div><b>${esc(f.livreur || '—')}</b></div>
      <div style="margin-top:6px" class="t">Récapitulatif</div>
      <div>Livrés : <b>${f.colis.filter(c=>c.status==='livre').length}</b> · Refusés : <b>${f.colis.filter(c=>c.status==='refuse').length}</b> · Annulés : <b>${f.colis.filter(c=>c.status==='annule').length}</b></div>
    </div>
  </div>

  <table>
    <thead><tr>
      <th class="c">N°</th><th>Commande</th><th>Client</th><th>Ville</th>
      <th class="c">Statut</th><th class="r">Prix</th><th class="r">Frais</th><th class="r">Net</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totbox">
    <div class="row"><span>Total Colis livrés</span><b>${fmt(f.totalLivre)} DH</b></div>
    <div class="row"><span>Total Frais</span><b>${fmt(f.totalFrais)} DH</b></div>
    <div class="row"><span>Frais supplémentaire</span><b>0.00 DH</b></div>
    <div class="row net"><span>TOTAL NET</span><span>${fmt(f.totalNet)} DH</span></div>
  </div>

  <div class="footer">
    Sauf erreur ou omission.
    <div class="thanks">VICTOURY vous remercie pour votre confiance 🤝</div>
  </div>
  </div>
  <script>window.onload=()=>window.print();</script>
  </body></html>`;

  const w = window.open('', '_blank');
  if (!w) { if (toast) toast.error('Popup bloqué — autorisez les popups pour télécharger le PDF.'); return; }
  w.document.write(html);
  w.document.close();
}

/* ─── helpers: get delivery fee from fraisList (supports partial city match) ─── */
function normalizeCity(name) {
  return (name || '').toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[-_\s']/g, '')
    .replace(/ou/g, 'u')
    .replace(/gu/g, 'g');
}

function getLivreurFraisFromList(fraisList, city, status) {
  if (!fraisList?.length || !city) return null;
  const cn = city.toLowerCase().trim();
  const cnN = normalizeCity(city);
  /* 1. Exact match */
  let row = fraisList.find(c => (c.ville || '').toLowerCase().trim() === cn);
  /* 2. Normalized match */
  if (!row) row = fraisList.find(c => normalizeCity(c.ville) === cnN);
  /* 3. Partial match */
  if (!row) row = fraisList.find(c => {
    const vl = (c.ville || '').toLowerCase().trim();
    return vl && (vl.includes(cn) || cn.includes(vl));
  });
  /* 4. Normalized partial match */
  if (!row) row = fraisList.find(c => {
    const vlN = normalizeCity(c.ville);
    return vlN && (vlN.includes(cnN) || cnN.includes(vlN));
  });
  if (!row) return null;
  if (status === 'livre')  return row.livre  ?? null;
  if (status === 'refuse') return row.refuse ?? null;
  if (status === 'annule') return row.annule ?? null;
  if (status === 'change') return row.change ?? null;
  return row.livre ?? null;
}

const normName = (s) => String(s || '').toLowerCase().trim();

function getLivreurFrais(livreurName, city, status, fraisCache, livreursList) {
  try {
    const list = livreursList || JSON.parse(localStorage.getItem('livreurs') || '[]');
    const target = normName(livreurName);
    const liv = list.find(l => normName(l.nom) === target);
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
  const [livreursList, setLivreursList] = useState([]);

  /* Load frais from cloud for all livreurs so city matching works even without localStorage */
  useEffect(() => {
    (async () => {
    let list = JSON.parse(localStorage.getItem('livreurs') || '[]');
    if (!list.length) {
      const remote = await cloudGet('livreurs');
      if (Array.isArray(remote) && remote.length) {
        list = remote;
        localStorage.setItem('livreurs', JSON.stringify(remote));
      }
    }
    setLivreursList(list);
    Promise.all(
      list.map(async (l) => {
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
          const auto = getLivreurFrais(liv, o.recipient?.city, o.status, cache, list);
          if (auto !== null) updated[id] = auto;
        }
        return updated;
      });
    });
    })();
  }, []);

  const eligible = useMemo(() => orders.filter(o =>
    ELIGIBLE_STATUSES.includes(o.status) && (o.validated || o.trackingNumber) && (livreur ? normName(o.recipient?.delivery) === normName(livreur) : true)
  ), [orders, livreur]);

  const livreurs = useMemo(() => {
    const seen = new Map();
    orders.map(o => o.recipient?.delivery).filter(Boolean).forEach(n => {
      const k = normName(n);
      if (!seen.has(k)) seen.set(k, n);
    });
    return [...seen.values()];
  }, [orders]);

  function getFraisForOrder(o) {
    const auto = getLivreurFrais(o.recipient?.delivery || livreur, o.recipient?.city, o.status, fraisCache, livreursList);
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
        city: o.recipient?.city,
        phone: o.recipient?.phone,
        product: o.product?.name || '',
        date: o.dateUpdated || o.dateAdded || '',
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-gray-800 text-lg">Nouvelle facture</h2>
          <button onClick={onClose} aria-label="Fermer"><X size={16} className="text-gray-400" /></button>
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
                      const autoFrais = getLivreurFrais(o.recipient?.delivery || livreur, o.recipient?.city, o.status, fraisCache, livreursList);
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
  const toast = useToast();
  const [factures, setFactures] = useState(() => loadFactures());
  const [newOpen, setNewOpen] = useState(false);

  useEffect(() => {
    loadFacturesRemote().then(remote => {
      if (Array.isArray(remote)) {
        setFactures(remote);
        saveFactures(remote);
      }
    });
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

    let currentUserId = null;
    supabase.auth.getUser().then(({ data }) => { currentUserId = data?.user?.id || null; });

    const channel = supabase
      .channel('settings-factures')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'settings',
        filter: 'key=eq.victoury_factures',
      }, (payload) => {
        const row = payload.new;
        if (currentUserId && row?.user_id && row.user_id !== currentUserId) return;
        const val = row?.value;
        if (Array.isArray(val)) {
          setFactures(val);
          localStorage.setItem('victoury_factures', JSON.stringify(val));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);
  const [detail, setDetail] = useState(null);
  const [filterLivreur, setFilterLivreur] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [notes, setNotes] = useState({});


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
    if (f.statut === 'paye') {
      updateFacture({ ...f, statut: 'en_attente', locked: false, datePaiement: null });
    } else {
      updateFacture({ ...f, statut: 'paye', locked: true, datePaiement: nowTs() });
    }
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
            <button onClick={reset} className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
              <RefreshCw size={13} /> Réinitialiser
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {/* Mobile card view */}
        <div className="md:hidden">
          {filtered.length === 0 && (
            <div className="py-16 text-center text-gray-400 flex flex-col items-center gap-2">
              <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>
              <span className="text-sm">Aucune facture trouvée</span>
            </div>
          )}
          {filtered.map(f => (
            <div key={f.id} className="bg-white border border-gray-200 rounded-lg p-4 mb-3 mx-4">
              {/* Top row: ref + statut */}
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold text-gray-700">{f.ref}</span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUT_STYLE[f.statut]}`}>
                  {STATUT_LABEL[f.statut]}
                </span>
              </div>
              {/* Livreur */}
              <div className="text-sm text-gray-700 mb-2">{f.livreur || '—'}</div>
              {/* Total Net */}
              <div className="font-bold text-green-700 mb-3">{fmt(f.totalNet)} DH</div>
              {/* Bottom row: toggles + actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">Clôturé</span>
                    <button onClick={() => toggleCloture(f)} className="focus:outline-none">
                      {f.locked
                        ? <div className="w-10 h-5 bg-blue-500 rounded-full flex items-center justify-end px-0.5"><div className="w-4 h-4 bg-white rounded-full shadow" /></div>
                        : <div className="w-10 h-5 bg-gray-300 rounded-full flex items-center px-0.5"><div className="w-4 h-4 bg-white rounded-full shadow" /></div>}
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">Versé</span>
                    <button onClick={() => toggleVerse(f)} className="focus:outline-none">
                      {f.statut === 'paye'
                        ? <div className="w-10 h-5 bg-green-500 rounded-full flex items-center justify-end px-0.5"><div className="w-4 h-4 bg-white rounded-full shadow" /></div>
                        : <div className="w-10 h-5 bg-gray-300 rounded-full flex items-center px-0.5"><div className="w-4 h-4 bg-white rounded-full shadow" /></div>}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setDetail(f)} title="Voir détail" aria-label="Voir détail"
                    className="p-1.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100"><Eye size={13} /></button>
                  <button onClick={() => printFacture(f, toast)} title="PDF" aria-label="Imprimer"
                    className="p-1.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200"><Printer size={13} /></button>
                  {!f.locked && (
                    <button onClick={() => del(f.id)} title="Supprimer" aria-label="Supprimer"
                      className="p-1.5 rounded bg-red-50 text-red-500 hover:bg-red-100"><Trash2 size={13} /></button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* Desktop table */}
        <div className="hidden md:block">
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
              <tr><td colSpan={12} className="py-16 text-center text-gray-400">
                <div className="flex flex-col items-center gap-2">
                  <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>
                  <span className="text-sm">Aucune facture trouvée</span>
                </div>
              </td></tr>
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
                    <button onClick={() => setDetail(f)} title="Voir détail" aria-label="Voir détail"
                      className="p-1.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100"><Eye size={13} /></button>
                    <button onClick={() => printFacture(f, toast)} title="PDF" aria-label="Imprimer"
                      className="p-1.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200"><Printer size={13} /></button>
                    {!f.locked && (
                      <button onClick={() => del(f.id)} title="Supprimer" aria-label="Supprimer"
                        className="p-1.5 rounded bg-red-50 text-red-500 hover:bg-red-100"><Trash2 size={13} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {newOpen && (
        <NewFactureModal orders={orders.filter(o => !factures.some(f => f.colis.some(c => c.orderId === o.id)))} onClose={() => setNewOpen(false)} onCreated={setFactures} />
      )}
    </div>
  );
}
