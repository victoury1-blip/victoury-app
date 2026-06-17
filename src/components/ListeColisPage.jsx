import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, ChevronDown, Check, Upload, FileSpreadsheet, Trash2, Phone, Pencil, Truck } from 'lucide-react';
import OrderModal from './OrderModal';
import { useStatuses } from '../contexts/StatusContext';
import ContactModal from './ContactModal';
import { cloudGet, cloudSet } from '../lib/cloudSettings';

/* ── Google Sheets status config ── */
const SHEET_STATUSES = [
  { value: 'confirme',   label: 'Confirmé',     color: '#16a34a' },
  { value: 'livre',      label: 'Livré',        color: '#2563eb' },
  { value: 'annule',     label: 'Annulé',       color: '#dc2626' },
  { value: 'refuse',     label: 'Refusé',       color: '#ea580c' },
  { value: 'retour',     label: 'Retour',       color: '#7c3aed' },
  { value: 'attente',    label: 'En attente',   color: '#d97706' },
  { value: 'pas_rep',    label: 'Pas répondu',  color: '#6b7280' },
];

const PRODUCT_KEYS = ['produit','product','article','designation','désignation','nom produit','libelle','libellé'];
const NOTE_KEYS    = ['note','remarque','observation','msg','message','commentaire'];

function SheetBadge({ status }) {
  const s = SHEET_STATUSES.find(x => x.value === status) || { label: '—', color: '#9ca3af' };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border"
      style={{ backgroundColor: s.color + '22', color: s.color, borderColor: s.color + '55' }}>
      {s.label}
    </span>
  );
}

function SheetStatusPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const current = SHEET_STATUSES.find(s => s.value === value);
  return (
    <div ref={ref} className="relative inline-block">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-2 py-1 rounded border text-xs font-semibold hover:opacity-80 transition"
        style={current ? { backgroundColor: current.color + '22', color: current.color, borderColor: current.color + '55' } : { backgroundColor: '#f3f4f6', color: '#6b7280', borderColor: '#d1d5db' }}>
        {current ? current.label : '— Statut —'}
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden min-w-[120px]">
          {SHEET_STATUSES.map(s => (
            <button key={s.value} onClick={() => { onChange(s.value); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-gray-50 transition">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
  const rows = lines.slice(1).map((line, idx) => {
    const vals = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) || [];
    const obj = { _id: `gs-${Date.now()}-${idx}`, _status: '' };
    headers.forEach((h, i) => { obj[h] = (vals[i] || '').replace(/^"|"$/g, '').trim(); });
    return obj;
  });
  return { headers, rows };
}

function SheetImportSection() {
  const [headers, setHeaders] = useState([]);
  const [rows, setRows]       = useState([]);
  const [search, setSearch]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [modifiedIds, setModifiedIds] = useState(new Set());
  const fileRef = useRef(null);

  useEffect(() => {
    const stored = localStorage.getItem('gs_import');
    if (stored) { const p = JSON.parse(stored); setHeaders(p.headers); setRows(p.rows); }
    cloudGet('gs_import').then(remote => {
      if (remote?.headers?.length) { setHeaders(remote.headers); setRows(remote.rows || []); }
    });
  }, []);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { headers: h, rows: r } = parseCSV(ev.target.result);
      setHeaders(h); setRows(r);
      cloudSet('gs_import', { headers: h, rows: r });
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  }

  function updateRow(id, patch) {
    setModifiedIds(prev => new Set([...prev, id]));
    setRows(prev => {
      const next = prev.map(r => r._id === id ? { ...r, ...patch } : r);
      cloudSet('gs_import', { headers, rows: next });
      return next;
    });
  }

  function clearAll() {
    if (!window.confirm('Effacer toutes les données importées ?')) return;
    setHeaders([]); setRows([]);
    localStorage.removeItem('gs_import');
    cloudSet('gs_import', { headers: [], rows: [] });
  }

  const productCol = headers.find(h => PRODUCT_KEYS.includes(h.toLowerCase()));

  const filtered = rows.filter(r => {
    const q = search.toLowerCase();
    const matchQ = !q || Object.values(r).some(v => String(v).toLowerCase().includes(q));
    const matchS = !filterStatus || r._status === filterStatus || modifiedIds.has(r._id);
    return matchQ && matchS;
  });

  const counts = SHEET_STATUSES.reduce((acc, s) => {
    acc[s.value] = rows.filter(r => r._status === s.value).length;
    return acc;
  }, {});

  if (!headers.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-center">
        <FileSpreadsheet size={48} className="text-green-400 mb-4" />
        <p className="text-gray-600 font-semibold text-lg mb-2">Importer depuis Google Sheets</p>
        <p className="text-gray-400 text-sm mb-6">Exportez votre feuille en CSV puis importez-la ici</p>
        <button onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition">
          <Upload size={15} /> Importer fichier CSV
        </button>
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
        <p className="text-gray-400 text-xs mt-4">Dans Google Sheets : Fichier → Télécharger → CSV</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Subheader */}
      <div className="bg-white border-b px-4 py-2 flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {SHEET_STATUSES.map(s => (
            <button key={s.value} onClick={() => setFilterStatus(f => f === s.value ? '' : s.value)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition ${filterStatus === s.value ? 'text-white' : 'bg-white'}`}
              style={filterStatus === s.value
                ? { backgroundColor: s.color, borderColor: s.color }
                : { color: s.color, borderColor: s.color + '55', backgroundColor: s.color + '15' }}>
              {s.label} <span className="opacity-75">({counts[s.value]})</span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs ml-2">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
            className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
        </div>
        <div className="flex gap-2 ml-auto">
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition">
            <Upload size={13} /> Nouveau CSV
          </button>
          <button onClick={clearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-100 transition">
            <Trash2 size={13} /> Effacer
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-8">#</th>
              {headers.map(h => (
                <th key={h} className={`px-3 py-3 text-left text-xs font-semibold uppercase whitespace-nowrap ${PRODUCT_KEYS.includes(h.toLowerCase()) ? 'text-blue-600' : 'text-gray-500'}`}>{h}</th>
              ))}
              <th className="px-3 py-3 text-left text-xs font-semibold text-amber-600 uppercase whitespace-nowrap">📝 Remarques</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={headers.length + 3} className="py-12 text-center text-gray-400 text-sm">Aucune ligne trouvée</td></tr>
            ) : filtered.map((row, idx) => (
              <tr key={row._id} className={`hover:bg-gray-50 ${row._status === 'livre' ? 'bg-blue-50/30' : row._status === 'confirme' ? 'bg-green-50/30' : row._status === 'annule' || row._status === 'refuse' ? 'bg-red-50/20' : ''}`}>
                <td className="px-3 py-2.5 text-xs text-gray-400">{idx + 1}</td>
                {headers.map(h => {
                  const isProduct = PRODUCT_KEYS.includes(h.toLowerCase());
                  const val = row[h] || '—';
                  return (
                    <td key={h} className="px-3 py-2.5 max-w-[180px]">
                      {isProduct
                        ? <span className="font-bold text-gray-800 text-sm">{val}</span>
                        : <span className="text-xs text-gray-600 line-clamp-2">{val}</span>
                      }
                    </td>
                  );
                })}
                {/* Editable notes */}
                <td className="px-3 py-2.5 min-w-[160px]">
                  <textarea
                    value={row._note || ''}
                    onChange={e => updateRow(row._id, { _note: e.target.value })}
                    rows={1}
                    placeholder="Ajouter une remarque..."
                    className="w-full text-xs border border-amber-200 rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-amber-300 bg-amber-50/50 placeholder-gray-300"
                    style={{ minHeight: '32px' }}
                    onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                  />
                </td>
                {/* Status */}
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {row._status
                    ? <div className="flex items-center gap-1.5">
                        <SheetBadge status={row._status} />
                        <button onClick={() => updateRow(row._id, { _status: '' })}
                          className="text-gray-300 hover:text-gray-500 transition"><X size={11} /></button>
                      </div>
                    : <SheetStatusPicker value={row._status} onChange={v => updateRow(row._id, { _status: v })} />
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="bg-white border-t px-6 py-2 text-xs text-gray-500 flex justify-between">
        <span>{filtered.length} / {rows.length} lignes affichées</span>
        <span className="flex gap-3">
          {SHEET_STATUSES.slice(0,4).map(s => counts[s.value] > 0 && (
            <span key={s.value} style={{ color: s.color }} className="font-semibold">{s.label}: {counts[s.value]}</span>
          ))}
        </span>
      </div>
    </div>
  );
}

function isLight(hex) {
  if (!hex || hex.length < 7) return true;
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return (r*299+g*587+b*114)/1000 > 155;
}

/* ── Status badge (reads live color from États page) ── */
function Badge({ statusKey }) {
  const { getLive } = useStatuses();
  const live = getLive(statusKey);
  const color = live.color || '#6B7280';
  const light = isLight(color);
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap"
      style={{ backgroundColor: color, color: light ? '#111' : '#fff' }}
    >
      {live.label || statusKey}
    </span>
  );
}

function PhoneChip({ phone }) {
  const [open, setOpen] = useState(false);
  if (!phone) return null;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full hover:bg-green-200 transition-colors"
      >
        <Phone size={9} /> {phone}
      </button>
      {open && <ContactModal phone={phone} onClose={() => setOpen(false)} />}
    </>
  );
}

/* ── Collapsible dark status picker ── */
function StatusPicker({ value, onChange }) {
  const { statuses } = useStatuses();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const sorted = [...statuses].filter(s => s.showInColis !== false).sort((a, b) => a.order - b.order);
  const current = statuses.find(s => s.value === value);

  useEffect(() => {
    if (!open) return;
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-[#2d2d3a] border border-[#3f3f52] rounded-lg text-white text-sm font-semibold hover:bg-[#38384a] transition-colors"
      >
        <span>{current?.label || value}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown list */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#2d2d3a] border border-[#3f3f52] rounded-lg shadow-2xl overflow-y-auto max-h-56">
          {sorted.map(s => (
            <button
              key={s.value} type="button"
              onClick={() => { onChange(s.value); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors
                ${s.value === value ? 'bg-[#3a3a50] text-white' : 'text-gray-200 hover:bg-[#38384a]'}`}
            >
              <span className="w-4 flex-shrink-0">{s.value === value && <Check size={13} />}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Status change modal ── */
function StatusModal({ order, onClose, onSave }) {
  const [newStatus, setNewStatus] = useState(order.status);
  const [note, setNote] = useState('');

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-800">Modifier le statut de la commande</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={16} className="text-gray-400" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nouveau statut</label>
            <StatusPicker value={newStatus} onChange={setNewStatus} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Note interne</label>
            <textarea
              value={note} onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
              placeholder="Ajouter une note..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-5">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
          <button
            onClick={() => { onSave(order.id, newStatus, note); onClose(); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Delivery status modal ── */
const DELIVERY_STATUSES = [
  { value: 'att_ramassage', label: 'En attente ramassage', color: '#f59e0b' },
  { value: 'expedier',      label: 'Expédié',              color: '#3b82f6' },
  { value: 'recu_livreur',  label: 'Reçu par livreur',     color: '#6366f1' },
  { value: 'livre',         label: 'Livré',                color: '#16a34a' },
  { value: 'change',        label: 'Échange',              color: '#0891b2' },
  { value: 'refuse',        label: 'Refusé',               color: '#ef4444' },
  { value: 'pas_rep_lv',    label: 'Pas répondu (liv.)',   color: '#9ca3af' },
  { value: 'pret_retour',   label: 'Prêt retour',          color: '#7c3aed' },
  { value: 'dem_suivi',     label: 'Dem. de suivi',        color: '#d97706' },
  { value: 'injoignable',   label: 'Injoignable',          color: '#dc2626' },
  { value: 'manque_stock',  label: 'Manque de stock',      color: '#b45309' },
];

function DeliveryStatusModal({ order, onClose, onSave }) {
  const [tab, setTab] = useState(order.trackingNumber ? 'history' : 'manual');
  const [status, setStatus] = useState(order.status);
  const [note, setNote] = useState('');
  const [historyState, setHistoryState] = useState('idle'); /* idle | loading | ok | error */
  const [historyData, setHistoryData] = useState(null);
  const current = DELIVERY_STATUSES.find(s => s.value === status);

  async function fetchOzoneHistory() {
    setHistoryState('loading');
    setHistoryData(null);
    try {
      const cfg = JSON.parse(localStorage.getItem('auzone_config') || '{}');
      if (!cfg.customerId || !cfg.apiKey) { setHistoryState('error'); return; }
      const tn = order.trackingNumber;
      /* Try multiple endpoint patterns */
      const endpoints = [
        `https://api.ozonexpress.ma/customers/${cfg.customerId}/${cfg.apiKey}/get-parcel?tracking-number=${tn}`,
        `https://api.ozonexpress.ma/customers/${cfg.customerId}/${cfg.apiKey}/get-parcels-history?tracking-number=${tn}`,
        `https://api.ozonexpress.ma/customers/${cfg.customerId}/${cfg.apiKey}/parcel-history/${tn}`,
      ];
      let raw = null;
      for (const url of endpoints) {
        try {
          const res = await fetch(url);
          if (res.ok) { raw = await res.json(); break; }
        } catch {}
      }
      if (!raw) { setHistoryState('error'); return; }
      /* Parse response — Ozone wraps in GET-PARCEL or GET-PARCELS-HISTORY */
      const parcel = raw['GET-PARCEL'] || raw['PARCEL'] || raw;
      const histArr = parcel['PARCEL-HISTORY'] || parcel['history'] || parcel['HISTORY'] || parcel['events'] || [];
      const info = {
        tracking: tn,
        receiver: parcel['PARCEL-RECEIVER'] || parcel['RECEIVER'] || order.recipient?.name,
        phone: parcel['PARCEL-PHONE'] || parcel['PHONE'] || order.recipient?.phone,
        city: parcel['CITY_NAME'] || parcel['CITY'] || order.recipient?.city,
        status: parcel['PARCEL-STATUS'] || parcel['STATUS'] || '',
        history: histArr,
      };
      setHistoryData(info);
      setHistoryState('ok');
    } catch { setHistoryState('error'); }
  }

  useEffect(() => {
    if (tab === 'history' && order.trackingNumber && historyState === 'idle') fetchOzoneHistory();
  }, [tab]);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-100"><Truck size={15} className="text-amber-600" /></span>
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Livraison — {order.trackingNumber || order.id}</h3>
              <p className="text-xs text-gray-400">{order.recipient?.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={15} className="text-gray-400" /></button>
        </div>

        {/* Tabs */}
        {order.trackingNumber && (
          <div className="flex border-b border-gray-100">
            {[{ k:'history', l:'📦 Historique Ozone' }, { k:'manual', l:'✏️ Statut manuel' }].map(t => (
              <button key={t.k} onClick={() => setTab(t.k)}
                className={`flex-1 py-2 text-xs font-semibold transition-colors ${tab === t.k ? 'text-amber-600 border-b-2 border-amber-500' : 'text-gray-400 hover:text-gray-600'}`}>
                {t.l}
              </button>
            ))}
          </div>
        )}

        <div className="p-4 max-h-[70vh] overflow-y-auto">
          {/* History tab */}
          {tab === 'history' && (
            <div>
              {historyState === 'loading' && (
                <div className="flex flex-col items-center gap-2 py-8 text-gray-400">
                  <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs">Récupération de l'historique Ozone Express...</p>
                </div>
              )}
              {historyState === 'error' && (
                <div className="py-6 text-center">
                  <p className="text-xs text-red-500 mb-2">Impossible de récupérer l'historique.</p>
                  <p className="text-xs text-gray-400 mb-3">Vérifiez la config API dans Paramètres.</p>
                  <button onClick={fetchOzoneHistory} className="text-xs text-amber-600 underline">Réessayer</button>
                </div>
              )}
              {historyState === 'ok' && historyData && (
                <div>
                  {/* Parcel info */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-3 text-xs space-y-0.5">
                    <p><span className="font-semibold text-gray-600">N° suivi:</span> <span className="font-mono text-amber-700">{historyData.tracking}</span></p>
                    <p><span className="font-semibold text-gray-600">Client:</span> {historyData.receiver}</p>
                    <p><span className="font-semibold text-gray-600">Téléphone:</span> {historyData.phone}</p>
                    <p><span className="font-semibold text-gray-600">Ville:</span> {historyData.city}</p>
                    {historyData.status && <p><span className="font-semibold text-gray-600">Statut actuel:</span> <span className="text-amber-700 font-semibold">{historyData.status}</span></p>}
                  </div>
                  {/* Timeline */}
                  {(() => {
                    /* Build events: API history + always show local status as fallback */
                    const localEvent = {
                      label: DELIVERY_STATUSES.find(s => s.value === order.status)?.label || order.status,
                      date: order.dateUpdated || order.dateAdded || '',
                      color: DELIVERY_STATUSES.find(s => s.value === order.status)?.color || '#f59e0b',
                      local: true,
                    };
                    const apiEvents = historyData.history.map(h => ({
                      label: h['STATUS'] || h['LABEL'] || h['status'] || h['label'] || h['event'] || JSON.stringify(h),
                      date: h['DATE'] || h['date'] || h['DATE_TIME'] || '',
                      color: '#f59e0b',
                      local: false,
                    }));
                    const events = apiEvents.length > 0 ? apiEvents : [localEvent];
                    return (
                      <div className="relative pl-4">
                        <div className="absolute left-1.5 top-0 bottom-0 w-px bg-gray-200" />
                        {events.map((ev, i) => (
                          <div key={i} className="relative mb-3 last:mb-0">
                            <span className="absolute -left-[11px] w-3 h-3 rounded-full border-2 border-white"
                              style={{ backgroundColor: i === 0 ? ev.color : '#d1d5db' }} />
                            <p className={`text-xs font-semibold ${i === 0 ? 'text-amber-700' : 'text-gray-700'}`}>{ev.label}</p>
                            {ev.date && <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">🕐 {ev.date}</p>}
                            {ev.local && <p className="text-[10px] text-blue-400 mt-0.5">📍 Statut local (non Ozone)</p>}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  <button onClick={fetchOzoneHistory} className="mt-3 w-full text-xs text-amber-600 border border-amber-200 rounded-lg py-1.5 hover:bg-amber-50 transition">🔄 Actualiser</button>
                </div>
              )}
            </div>
          )}

          {/* Manual tab */}
          {tab === 'manual' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-1.5 max-h-52 overflow-y-auto pr-1">
                {DELIVERY_STATUSES.map(s => (
                  <button key={s.value} onClick={() => setStatus(s.value)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-left transition-all border ${
                      status === s.value ? 'text-white font-semibold border-transparent' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                    style={status === s.value ? { backgroundColor: s.color, borderColor: s.color } : {}}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                    {s.label}
                    {status === s.value && <Check size={12} className="ml-auto" />}
                  </button>
                ))}
              </div>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Note interne (optionnel)..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none" />
              <div className="flex justify-end gap-2">
                <button onClick={onClose} className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-50">Annuler</button>
                <button onClick={() => onSave(order.id, status, note)}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition"
                  style={{ backgroundColor: current?.color || '#f59e0b' }}>
                  Enregistrer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main page ── */
const COLIS_PIPELINE = ['att_ramassage','expedier','recu_livreur','livre','change','refuse','pas_rep_lv','pret_retour','dem_suivi','injoignable','manque_stock','en_suivi'];

export default function ListeColisPage({ orders, setOrders, isLoading }) {
  const [tab, setTab] = useState('colis');
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [livreurOpen, setLivreurOpen] = useState(false);
  const livreurRef = useRef(null);
  const emptyFilter = { livreur: '', ville: '', produit: '', dateFrom: '', dateTo: '' };
  const [filterForm, setFilterForm] = useState(emptyFilter);
  const [appliedFilter, setAppliedFilter] = useState(emptyFilter);
  const isFilterActive = Object.values(appliedFilter).some(v => v !== '');
  function applyFilter() { setAppliedFilter({ ...filterForm }); setFilterOpen(false); }
  function resetFilter() { setFilterForm(emptyFilter); setAppliedFilter(emptyFilter); setLivreurOpen(false); }
  function parseFrDate(str) {
    if (!str) return null;
    const m = str.match(/(\d+)\/(\d+)\/(\d+)/);
    return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
  }
  React.useEffect(() => {
    if (!livreurOpen) return;
    function handler(e) { if (livreurRef.current && !livreurRef.current.contains(e.target)) setLivreurOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [livreurOpen]);
  const [editOrder, setEditOrder] = useState(null);
  const [editOrderFull, setEditOrderFull] = useState(null);
  const [deliveryOrder, setDeliveryOrder] = useState(null);
  const [selected, setSelected] = useState([]);

  /* Manual facture toggles stored in localStorage */
  const [manualFacture, setManualFacture] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('victoury_manual_facture') || '[]')); }
    catch { return new Set(); }
  });

  /* Reçu toggles stored in localStorage */
  const [recuIds, setRecuIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('victoury_recu_ids') || '[]')); }
    catch { return new Set(); }
  });

  function toggleRecu(orderId) {
    setRecuIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) { next.delete(orderId); } else { next.add(orderId); }
      localStorage.setItem('victoury_recu_ids', JSON.stringify([...next]));
      return next;
    });
  }

  /* Derive facture status: auto (from factures) OR manual toggle */
  const facturedIds = useMemo(() => {
    try {
      const list = JSON.parse(localStorage.getItem('victoury_factures') || '[]');
      const autoIds = new Set(list.flatMap(f => (f.colis || []).map(c => c.orderId)));
      return new Set([...autoIds, ...manualFacture]);
    } catch { return new Set([...manualFacture]); }
  }, [orders, manualFacture]);

  function toggleFacture(orderId) {
    setManualFacture(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) { next.delete(orderId); } else { next.add(orderId); }
      localStorage.setItem('victoury_manual_facture', JSON.stringify([...next]));
      return next;
    });
  }

  function toggleSelect(id) {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }
  function toggleAll() {
    setSelected((prev) => prev.length === colis.length ? [] : colis.map((o) => o.id));
  }

  /* Show only orders in the colis pipeline */
  const colis = useMemo(() => {
    const q = search.toLowerCase();
    const af = appliedFilter;
    return orders.filter((o) => {
      const inPipeline = COLIS_PIPELINE.includes(o.status) || (!!o.trackingNumber && !!o.validated);
      if (!inPipeline) return false;
      const matchSearch = !q ||
        o.id.toLowerCase().includes(q) ||
        o.recipient.name.toLowerCase().includes(q) ||
        o.recipient.city.toLowerCase().includes(q) ||
        (o.trackingNumber || '').toLowerCase().includes(q);
      if (!matchSearch) return false;
      if (af.livreur && !(o.recipient.delivery || '').toLowerCase().includes(af.livreur.toLowerCase())) return false;
      if (af.ville && !(o.recipient.city || '').toLowerCase().includes(af.ville.toLowerCase())) return false;
      if (af.produit) {
        const prods = o.products?.length ? o.products : [o.product];
        if (!prods.some(p => p?.name?.toLowerCase().includes(af.produit.toLowerCase()))) return false;
      }
      if (af.dateFrom || af.dateTo) {
        const d = parseFrDate(o.dateAdded);
        if (d) {
          if (af.dateFrom && d < new Date(af.dateFrom)) return false;
          if (af.dateTo && d > new Date(af.dateTo)) return false;
        }
      }
      return true;
    });
  }, [orders, search, appliedFilter]);

  function getTs() {
    const tz = localStorage.getItem('system_timezone') || 'Africa/Casablanca';
    return new Date().toLocaleString('fr-FR', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '');
  }

  function handleStatusSave(orderId, newStatus, note) {
    const ts = getTs();
    setOrders((prev) => prev.map((o) => {
      if (o.id !== orderId) return o;
      const prevNote = o.note || '';
      const addedNote = note ? `\nNote interne: ${note}` : '';
      return { ...o, status: newStatus, dateUpdated: ts, note: prevNote + addedNote };
    }));
  }

  function saveOrderFull(updated) {
    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
    setEditOrderFull(null);
  }

  function deactivateOrder(orderId) {
    const ts = getTs();
    setOrders(prev => prev.map(o => o.id === orderId
      ? { ...o, status: 'confirme', dateUpdated: ts, validated: false, trackingNumber: null }
      : o
    ));
  }

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-400 font-medium">Chargement des colis…</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header with tabs */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        <span className="font-bold text-gray-700 text-base">Liste des colis</span>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          <button onClick={() => setTab('colis')}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition ${tab === 'colis' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            📦 Colis <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{colis.length}</span>
          </button>
          <button onClick={() => setTab('sheet')}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition ${tab === 'sheet' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            📊 Google Sheets
          </button>
        </div>
        {tab === 'colis' && (
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un colis..."
              className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        )}
        {tab === 'colis' && (
          <button
            onClick={() => setFilterOpen(o => !o)}
            className={`ml-auto p-2 rounded-md border text-sm transition-colors ${
              isFilterActive ? 'border-indigo-400 bg-indigo-50 text-indigo-600'
              : filterOpen ? 'border-gray-400 bg-gray-100 text-gray-700'
              : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
            title="Filtre avancé"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          </button>
        )}
      </div>

      {/* Advanced Filter Panel */}
      {filterOpen && tab === 'colis' && (() => {
        const livreursList = (() => { try { return JSON.parse(localStorage.getItem('livreurs') || '[]'); } catch { return []; } })();
        const livFiltered = livreursList.filter(l => l.statut !== false && (!filterForm.livreur || l.nom.toLowerCase().includes(filterForm.livreur.toLowerCase())));
        return (
          <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="font-bold text-gray-700 text-sm tracking-wide">Filtre avancé</span>
              <button onClick={() => setFilterOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Livreurs — autocomplete */}
              <div ref={livreurRef} className="relative">
                <label className="block text-xs text-gray-500 font-semibold mb-1">Livreurs</label>
                <div className="relative">
                  <input
                    value={filterForm.livreur}
                    onChange={e => { setFilterForm(p => ({ ...p, livreur: e.target.value })); setLivreurOpen(true); }}
                    onFocus={() => setLivreurOpen(true)}
                    placeholder="Rechercher un livreur..."
                    className="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-400 pr-7"
                  />
                  <Search size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500" />
                </div>
                {livreurOpen && livFiltered.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded shadow-lg max-h-44 overflow-y-auto">
                    {filterForm.livreur && (
                      <div className="px-3 py-2 text-xs text-gray-400 cursor-pointer hover:bg-gray-50" onMouseDown={() => { setFilterForm(p => ({ ...p, livreur: '' })); setLivreurOpen(false); }}>— Tous les livreurs</div>
                    )}
                    {livFiltered.map(l => (
                      <div key={l.id}
                        onMouseDown={() => { setFilterForm(p => ({ ...p, livreur: l.nom })); setLivreurOpen(false); }}
                        className="px-3 py-2 text-sm text-gray-800 cursor-pointer hover:bg-gray-50 border-b border-gray-50 last:border-0">
                        {l.nom} {l.telephone ? <span className="text-gray-400">({l.telephone})</span> : <span className="text-gray-400">()</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Villes */}
              <div>
                <label className="block text-xs text-gray-500 font-semibold mb-1">Villes</label>
                <div className="relative">
                  <input value={filterForm.ville} onChange={e => setFilterForm(p => ({ ...p, ville: e.target.value }))} placeholder="Rechercher une ville..." className="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-400 pr-7" />
                  <Search size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500" />
                </div>
              </div>
              {/* Produits */}
              <div>
                <label className="block text-xs text-gray-500 font-semibold mb-1">Produits</label>
                <div className="relative">
                  <input value={filterForm.produit} onChange={e => setFilterForm(p => ({ ...p, produit: e.target.value }))} placeholder="Rechercher un produit..." className="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-400 pr-7" />
                  <Search size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500" />
                </div>
              </div>
              {/* Date d'ajout */}
              <div>
                <label className="block text-xs text-gray-500 font-semibold mb-1">Date d'ajout</label>
                <div className="flex gap-1">
                  <input type="date" value={filterForm.dateFrom} onChange={e => setFilterForm(p => ({ ...p, dateFrom: e.target.value }))} className="flex-1 bg-white border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-indigo-400" />
                  <input type="date" value={filterForm.dateTo} onChange={e => setFilterForm(p => ({ ...p, dateTo: e.target.value }))} className="flex-1 bg-white border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-indigo-400" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={resetFilter} className="px-4 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-sm text-gray-600 font-medium transition-colors border border-gray-300">Réinitialiser</button>
              <button onClick={applyFilter} className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-sm text-white font-semibold transition-colors">Appliquer les filtres</button>
            </div>
          </div>
        );
      })()}

      {tab === 'sheet' && <SheetImportSection />}

      {/* Table */}
      <div className={`flex-1 overflow-auto ${tab === 'sheet' ? 'hidden' : ''}`}>
        <table className="w-full text-sm border-collapse min-w-[900px]">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <tr>
                <th className="px-4 py-3 w-8">
                <input type="checkbox" checked={colis.length > 0 && selected.length === colis.length} onChange={toggleAll} className="w-4 h-4 rounded" />
              </th>
            {['Destinataire', 'Produits', 'Prix', 'État', 'Note', 'LIV', 'Date', 'Validé', 'Action'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {colis.length === 0 ? (
              <tr><td colSpan={10} className="py-16 text-center text-gray-400 text-sm">Aucun colis dans le pipeline</td></tr>
            ) : colis.map((o) => {
              const note = (o.note || '').replace('Note interne: ', '').trim();
              const delivery = o.recipient?.delivery || '—';
              return (
                <tr key={o.id} className={`transition-colors ${selected.includes(o.id) ? 'bg-indigo-50 border-l-[3px] border-indigo-500' : 'hover:bg-gray-50 border-l-[3px] border-transparent'}`}>
                  {/* Checkbox */}
                  <td className="px-4 py-3 w-8">
                    <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggleSelect(o.id)} className="w-4 h-4 rounded" />
                  </td>
                  {/* Destinataire */}
                  <td className="px-4 py-3">
                    <div className="font-semibold text-blue-700 text-xs">{o.id}</div>
                    <div className="font-medium text-gray-800">{o.recipient.name}</div>
                    <div className="text-xs text-gray-400">{o.recipient.address}</div>
                    <div className="text-xs text-gray-500">{o.recipient.city}</div>
                    {o.recipient.phone && <div className="mt-0.5"><PhoneChip phone={o.recipient.phone} /></div>}
                    {delivery !== '—' && <div className="text-xs text-blue-500 mt-0.5">🚚 {delivery}</div>}
                    {o.trackingNumber && <div className="text-xs text-orange-600 font-mono mt-0.5">📦 {o.trackingNumber}</div>}
                  </td>

                  {/* Produits */}
                  <td className="px-4 py-3 min-w-[160px]">
                    {(o.products?.length > 0 ? o.products : [o.product]).map((p, i) => p && (
                      <div key={i} className="text-sm leading-snug mb-0.5">
                        <span className="font-medium text-gray-800">{p.name}</span>
                        {p.size && <span className="ml-1 text-xs text-gray-500">/ {p.size}</span>}
                        <span className="ml-1 text-xs text-gray-400">×{p.qty || 1}</span>
                      </div>
                    ))}
                  </td>

                  {/* Prix */}
                  <td className="px-4 py-3 font-bold text-gray-800 whitespace-nowrap">
                    {Number(o.price || 0).toFixed(2)} DH
                  </td>

                  {/* État — click to change */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setEditOrder(o)}
                      className="flex items-center gap-1 group"
                      title="Cliquer pour modifier le statut"
                    >
                      <Badge statusKey={o.status} />
                      <ChevronDown size={10} className="text-gray-400 group-hover:text-gray-600" />
                    </button>

                    {/* Sub-status: facture toggle (persisted in localStorage) */}
                    {o.status === 'livre' && (
                      <button
                        onClick={() => toggleFacture(o.id)}
                        className={`mt-1 text-xs px-2 py-0.5 rounded-full border font-semibold transition-colors ${
                          facturedIds.has(o.id)
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200'
                            : 'bg-gray-100 text-gray-500 border-gray-300 hover:bg-yellow-50 hover:border-yellow-300 hover:text-yellow-700'
                        }`}
                      >
                        {facturedIds.has(o.id) ? '✓ Facturé' : 'Pas facturé'}
                      </button>
                    )}
                    {(o.status === 'refuse' || o.status === 'annule') && (
                      <button
                        onClick={() => toggleRecu(o.id)}
                        className={`mt-1 text-xs px-2 py-0.5 rounded-full border font-semibold transition-colors ${
                          recuIds.has(o.id)
                            ? 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200'
                            : 'bg-red-50 text-red-500 border-red-200 hover:bg-red-100'
                        }`}
                      >
                        {recuIds.has(o.id) ? '✓ Reçus' : 'Non reçu'}
                      </button>
                    )}
                  </td>

                  {/* Note */}
                  <td className="px-4 py-3 max-w-[180px]">
                    {note && <span className="text-xs text-gray-600 line-clamp-2">Note interne: {note}</span>}
                  </td>

                  {/* LIV */}
                  <td className="px-4 py-3">
                    {delivery !== '—' ? (
                      <span className="text-xs font-semibold px-2 py-1 rounded bg-amber-100 text-amber-700">{delivery}</span>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3 text-xs text-gray-500">
                    <div><span className="font-medium text-gray-600">Date ajout:</span><br />{o.dateAdded}</div>
                    <div className="mt-1"><span className="font-medium text-gray-600">Date mise à jour:</span><br />{o.dateUpdated}</div>
                  </td>

                  {/* Validé — green dot = active in pipeline, click to deactivate */}
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => deactivateOrder(o.id)}
                      title="Désactiver → retour Confirmé"
                      className="inline-flex items-center justify-center w-6 h-6 rounded-full hover:ring-2 hover:ring-green-300 transition-all"
                    >
                      <span className="w-4 h-4 rounded-full bg-green-400 shadow shadow-green-200 inline-block" />
                    </button>
                  </td>

                  {/* Action */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5">
                      <button
                        onClick={() => setEditOrderFull(o)}
                        className="p-1.5 rounded bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                        title="Modifier la commande"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setDeliveryOrder(o)}
                        className="p-1.5 rounded bg-amber-100 text-amber-600 hover:bg-amber-200 transition-colors"
                        title="Statut livraison"
                      >
                        <Truck size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {tab === 'colis' && (
        <div className="bg-white border-t border-gray-200 px-6 py-2 text-xs text-gray-500 flex justify-between">
          <span>{colis.length} colis affichés</span>
          <span>Total: {orders.length} commandes</span>
        </div>
      )}

      {editOrder && (
        <StatusModal
          order={editOrder}
          onClose={() => setEditOrder(null)}
          onSave={(id, status, note) => { handleStatusSave(id, status, note); setEditOrder(null); }}
        />
      )}

      {editOrderFull && (
        <OrderModal
          order={editOrderFull}
          onClose={() => setEditOrderFull(null)}
          onSave={saveOrderFull}
        />
      )}

      {deliveryOrder && (
        <DeliveryStatusModal
          order={deliveryOrder}
          onClose={() => setDeliveryOrder(null)}
          onSave={(id, status, note) => { handleStatusSave(id, status, note); setDeliveryOrder(null); }}
        />
      )}
    </div>
  );
}
