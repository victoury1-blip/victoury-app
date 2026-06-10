import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, ChevronDown, Check, Upload, FileSpreadsheet, Trash2, Phone } from 'lucide-react';
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

/* ── Main page ── */
const COLIS_PIPELINE = ['att_ramassage','expedier','recu_livreur','livre','change','refuse','pas_rep_lv','pret_retour','dem_suivi','injoignable','manque_stock','en_suivi'];

export default function ListeColisPage({ orders, setOrders, isLoading }) {
  const [tab, setTab] = useState('colis');
  const [search, setSearch] = useState('');
  const [editOrder, setEditOrder] = useState(null);

  /* Show only orders in the colis pipeline */
  const colis = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter((o) => {
      const inPipeline = COLIS_PIPELINE.includes(o.status) || !!o.trackingNumber;
      const matchSearch = !q ||
        o.id.toLowerCase().includes(q) ||
        o.recipient.name.toLowerCase().includes(q) ||
        o.recipient.city.toLowerCase().includes(q) ||
        (o.trackingNumber || '').toLowerCase().includes(q);
      return inPipeline && matchSearch;
    });
  }, [orders, search]);

  function handleStatusSave(orderId, newStatus, note) {
    const t = new Date();
    const ts = `${String(t.getDate()).padStart(2,'0')}/${String(t.getMonth()+1).padStart(2,'0')}/${t.getFullYear()} ${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`;
    setOrders((prev) => prev.map((o) => {
      if (o.id !== orderId) return o;
      const prevNote = o.note || '';
      const addedNote = note ? `\nNote interne: ${note}` : '';
      return { ...o, status: newStatus, dateUpdated: ts, note: prevNote + addedNote };
    }));
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
      </div>

      {tab === 'sheet' && <SheetImportSection />}

      {/* Table */}
      <div className={`flex-1 overflow-auto ${tab === 'sheet' ? 'hidden' : ''}`}>
        <table className="w-full text-sm border-collapse min-w-[900px]">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <tr>
              {['Destinataire', 'Produits', 'Prix', 'État', 'Note', 'LIV', 'Date', 'Validé', 'Action'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {colis.length === 0 ? (
              <tr><td colSpan={9} className="py-16 text-center text-gray-400 text-sm">Aucun colis dans le pipeline</td></tr>
            ) : colis.map((o) => {
              const note = (o.note || '').replace('Note interne: ', '').trim();
              const delivery = o.recipient?.delivery || '—';
              return (
                <tr key={o.id} className="hover:bg-gray-50">
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
                  <td className="px-4 py-3">
                    <div className="text-xs font-medium text-gray-800">
                      {o.product?.name} {o.product?.size && `- ${o.product.size}`}
                    </div>
                    <div className="text-xs text-gray-500">
                      (1x) {o.product?.stock !== undefined && `(stock:${o.product.stock})`}
                    </div>
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

                    {/* Sub-status toggle */}
                    {o.status === 'livre' && (
                      <button
                        onClick={() => setOrders(prev => prev.map(x => x.id === o.id ? { ...x, facture: !x.facture } : x))}
                        className={`mt-1 text-xs px-2 py-0.5 rounded-full border font-semibold transition-colors ${
                          o.facture
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                            : 'bg-gray-100 text-gray-500 border-gray-300 hover:bg-yellow-50 hover:border-yellow-300 hover:text-yellow-700'
                        }`}
                      >
                        {o.facture ? '✓ Facturé' : 'Pas facturé'}
                      </button>
                    )}
                    {(o.status === 'refuse' || o.status === 'annule') && (
                      <button
                        onClick={() => setOrders(prev => prev.map(x => x.id === o.id ? { ...x, recu: !x.recu } : x))}
                        className={`mt-1 text-xs px-2 py-0.5 rounded-full border font-semibold transition-colors ${
                          o.recu
                            ? 'bg-blue-100 text-blue-700 border-blue-300'
                            : 'bg-red-50 text-red-500 border-red-200 hover:bg-red-100'
                        }`}
                      >
                        {o.recu ? '✓ Reçu' : 'Non reçu'}
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

                  {/* Validé */}
                  <td className="px-4 py-3">
                    <span className={`w-4 h-4 rounded-full inline-block ${o.validated ? 'bg-green-400' : 'bg-gray-200'}`} />
                  </td>

                  {/* Action */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setEditOrder(o)}
                      className="px-2 py-1 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100"
                    >
                      Statut
                    </button>
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
    </div>
  );
}
