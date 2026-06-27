import React, { useState, useMemo, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Pagination, { paginate } from './Pagination';
import { Search, X, ChevronDown, Check, Upload, FileSpreadsheet, Trash2, Phone, Pencil, Truck, MapPin, Download, Printer, BookmarkPlus, Bookmark, Clock } from 'lucide-react';
import OrderModal from './OrderModal';
import { buildWhatsappMessage } from '../lib/whatsappTemplates';
import { openLabelPage } from './LabelPrint';
import { useStatuses } from '../contexts/StatusContext';
import { cloudGet, cloudSet } from '../lib/cloudSettings';
import PhoneChip, { normalizePhone } from './PhoneChip';

/* ── Google Sheets status config ── */
const SHEET_STATUSES = [
  { value: 'confirme',   label: 'Confirmé',     color: '#16a34a' },
  { value: 'livre',      label: 'Livré',        color: '#2563eb' },
  { value: 'annule',     label: 'Annulé',       color: '#dc2626' },
  { value: 'refuse',     label: 'Refusé',       color: '#ea580c' },
  { value: 'retour',     label: 'Retour',       color: '#7c3aed' },
  { value: 'attente',    label: 'En Attente',   color: '#d97706' },
  { value: 'pas_rep',    label: 'Pas Répondu',  color: '#6b7280' },
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

  function splitCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if ((ch === ',' || ch === ';') && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  const headers = splitCSVLine(lines[0]);
  const rows = lines.slice(1).filter(l => l.trim()).map((line, idx) => {
    const vals = splitCSVLine(line);
    const obj = { _id: `gs-${Date.now()}-${idx}`, _status: '' };
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  });
  return { headers, rows };
}

function SheetImportSection({ orders = [], setOrders }) {
  const [headers, setHeaders] = useState([]);
  const [rows, setRows]       = useState([]);
  const [search, setSearch]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [modifiedIds, setModifiedIds] = useState(new Set());
  const fileRef = useRef(null);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [pendingData, setPendingData] = useState(null);
  const [colMap, setColMap] = useState({});
  const [importStatus, setImportStatus] = useState('att_ramassage');

  useEffect(() => {
    const stored = localStorage.getItem('gs_import');
    if (stored) {
      const p = JSON.parse(stored);
      setHeaders(p.headers); setRows(p.rows);
      if (p.colMap) setColMap(p.colMap);
    }
    cloudGet('gs_import').then(remote => {
      if (remote?.headers?.length) {
        setHeaders(remote.headers); setRows(remote.rows || []);
        if (remote.colMap) setColMap(remote.colMap);
      }
    });
  }, []);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      let text = ev.target.result;
      if (text.includes('\t') && !text.includes(',') && !text.includes(';')) {
        text = text.split('\n').map(l => l.split('\t').map(c => c.includes(',') ? `"${c}"` : c).join(',')).join('\n');
      }
      const { headers: h, rows: r } = parseCSV(text);
      if (!h.length) { alert('Fichier non reconnu.'); return; }
      setPendingData({ headers: h, rows: r });
      setMappingOpen(true);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  }

  function applyMapping(mapping) {
    if (!pendingData) return;
    setColMap(mapping);
    setHeaders(pendingData.headers);
    setRows(pendingData.rows);
    const gsData = { headers: pendingData.headers, rows: pendingData.rows, colMap: mapping };
    localStorage.setItem('gs_import', JSON.stringify(gsData));
    cloudSet('gs_import', gsData);
    setPendingData(null);
    setMappingOpen(false);
  }

  function updateRow(id, patch) {
    setModifiedIds(prev => new Set([...prev, id]));
    setRows(prev => {
      const next = prev.map(r => r._id === id ? { ...r, ...patch } : r);
      const gsData = { headers, rows: next };
      localStorage.setItem('gs_import', JSON.stringify(gsData));
      cloudSet('gs_import', gsData);
      return next;
    });
  }

  function clearAll() {
    if (!window.confirm('Effacer toutes les données importées ?')) return;
    setHeaders([]); setRows([]);
    localStorage.removeItem('gs_import');
    cloudSet('gs_import', { headers: [], rows: [] });
  }

  const productCol = colMap['product'] || headers.find(h => PRODUCT_KEYS.includes(h.toLowerCase()));

  const PHONE_KEYS = ['telephone','téléphone','tel','tél','phone','numero','numéro','mobile','gsm','num'];
  const NAME_KEYS = ['nom','name','destinataire','client','receiver','prenom','prénom'];
  const CITY_KEYS = ['ville','city','wilaya','region','région'];
  const ADDRESS_KEYS = ['adresse','address','rue','quartier'];
  const PRICE_KEYS = ['prix','price','montant','total','cod','amount'];
  const CODE_KEYS = ['code','id','ref','reference','référence','code denvoi','code_denvoi','tracking'];

  const findCol = (field, keys) => {
    if (colMap[field]) return colMap[field];
    return headers.find(h => {
      const low = h.toLowerCase().replace(/[^a-zàâéèêëïîôùûüç0-9]/g, '');
      return keys.some(k => low === k || low.includes(k));
    });
  };
  const phoneCol = findCol('phone', PHONE_KEYS);
  const nameCol = findCol('name', NAME_KEYS);
  const cityCol = findCol('city', CITY_KEYS);
  const addressCol = findCol('address', ADDRESS_KEYS);
  const priceCol = findCol('price', PRICE_KEYS);
  const codeCol = findCol('code', CODE_KEYS);


  function importToColis(rowsToImport) {
    const existingIds = new Set(orders.map(o => o.id));
    const newOrders = [];
    for (const row of rowsToImport) {
      const code = (codeCol && row[codeCol]) || row._id;
      if (existingIds.has(code)) continue;
      const name = (nameCol && row[nameCol]) || '';
      const phone = (phoneCol && row[phoneCol]) || '';
      const city = (cityCol && row[cityCol]) || '';
      const address = (addressCol && row[addressCol]) || '';
      const price = parseFloat((priceCol && row[priceCol]) || '0') || 0;
      const product = (productCol && row[productCol]) || '';
      const ts = new Date().toLocaleString('fr-MA');
      newOrders.push({
        id: code,
        recipient: { name, phone, city, address, delivery: null },
        product: { name: product, size: '', color: '', qty: 1, stock: 0 },
        products: product ? [{ name: product, size: '', color: '', qty: 1 }] : null,
        price,
        status: importStatus,
        note: '',
        dateAdded: ts,
        dateUpdated: ts,
        validated: true,
        trackingNumber: code,
      });
      existingIds.add(code);
    }
    if (!newOrders.length) { alert('Tous ces colis existent déjà dans le pipeline.'); return; }
    setOrders(prev => [...newOrders, ...prev]);
    alert(`${newOrders.length} colis importé(s) vers Liste des colis.`);
  }
  const livrePhones = useMemo(() => {
    const set = new Set();
    orders.forEach(o => {
      if (o.status === 'livre' && o.recipient?.phone) set.add(normalizePhone(o.recipient.phone));
    });
    return set;
  }, [orders]);

  function isDelivered(row) {
    if (!phoneCol) return false;
    const phone = normalizePhone(row[phoneCol]);
    return phone.length >= 8 && livrePhones.has(phone);
  }

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

  const MAPPING_FIELDS = [
    { key: 'code',    label: 'Code / ID',    icon: '#' },
    { key: 'name',    label: 'Nom client',   icon: '👤' },
    { key: 'phone',   label: 'Téléphone',    icon: '📞' },
    { key: 'address', label: 'Adresse',      icon: '📍' },
    { key: 'city',    label: 'Ville',        icon: '🏙️' },
    { key: 'price',   label: 'Prix',         icon: '💰' },
    { key: 'product', label: 'Produit',      icon: '📦' },
  ];

  const IMPORT_STATUSES = [
    { value: 'att_ramassage', label: 'En attente ramassage', color: '#f59e0b' },
    { value: 'livre',         label: 'Livré',               color: '#16a34a' },
    { value: 'refuse',        label: 'Refusé',              color: '#ef4444' },
    { value: 'annule',        label: 'Annulé',              color: '#dc2626' },
    { value: 'retour',        label: 'Retour',              color: '#7c3aed' },
    { value: 'expedier',      label: 'Expédié',             color: '#3b82f6' },
    { value: 'ramasse',       label: 'Ramassé',             color: '#6366f1' },
  ];


  const mappingModal = mappingOpen && pendingData && (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-green-50">
          <h3 className="font-bold text-green-800 text-sm">Mapping des colonnes</h3>
          <p className="text-xs text-green-600 mt-0.5">Associez chaque champ à la bonne colonne du CSV</p>
        </div>
        <div className="p-4 space-y-2.5">
          <div className="bg-gray-50 rounded-lg p-2 text-[10px] text-gray-500 mb-2">
            Aperçu: <span className="font-mono font-semibold">{pendingData.headers.join(' | ')}</span>
          </div>
          {MAPPING_FIELDS.map(f => (
            <div key={f.key} className="flex items-center gap-3">
              <span className="w-24 text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <span>{f.icon}</span> {f.label}
              </span>
              <select
                value={colMap[f.key] || ''}
                onChange={e => setColMap(p => ({ ...p, [f.key]: e.target.value || undefined }))}
                className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-300"
              >
                <option value="">— Auto —</option>
                {pendingData.headers.map(h => (
                  <option key={h} value={h}>{h}{pendingData.rows[0] ? ` (ex: ${String(pendingData.rows[0][h] || '').slice(0, 20)})` : ''}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div className="px-4 pb-3">
          <p className="text-xs font-semibold text-gray-700 mb-1.5">Statut à l'import :</p>
          <div className="flex flex-wrap gap-1.5">
            {IMPORT_STATUSES.map(s => (
              <button key={s.value} onClick={() => setImportStatus(s.value)}
                className="px-2.5 py-1 rounded-full text-xs font-semibold border transition"
                style={importStatus === s.value
                  ? { background: s.color, color: '#fff', borderColor: s.color }
                  : { background: '#f9fafb', color: s.color, borderColor: s.color + '44' }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 px-4 py-3 border-t border-gray-100">
          <button onClick={() => { setMappingOpen(false); setPendingData(null); }}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
          <button onClick={() => applyMapping(colMap)}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700">Confirmer</button>
        </div>
      </div>
    </div>
  );

  if (!headers.length) {
    return (
      <>
        {mappingModal}
        <div className="flex flex-col items-center justify-center h-full py-20 text-center">
          <FileSpreadsheet size={48} className="text-green-400 mb-4" />
          <p className="text-gray-600 font-semibold text-lg mb-2">Importer depuis Google Sheets</p>
          <p className="text-gray-400 text-sm mb-6">Exportez votre feuille en CSV puis importez-la ici</p>
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition">
            <Upload size={15} /> Importer fichier CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleFile} />
          <p className="text-gray-400 text-xs mt-4">Dans Google Sheets : Fichier → Télécharger → CSV</p>
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {mappingModal}
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
          <button onClick={() => importToColis(filtered)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition">
            <Truck size={13} /> Importer vers Colis ({filtered.length})
          </button>
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition">
            <Upload size={13} /> Nouveau CSV
          </button>
          <button onClick={clearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-100 transition">
            <Trash2 size={13} /> Effacer
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleFile} />
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
            ) : filtered.map((row, idx) => {
              const delivered = isDelivered(row);
              return (
              <tr key={row._id} className={`hover:bg-gray-50 ${row._status === 'livre' ? 'bg-blue-50/30' : row._status === 'confirme' ? 'bg-green-50/30' : row._status === 'annule' || row._status === 'refuse' ? 'bg-red-50/20' : ''}`}>
                <td className="px-3 py-2.5 text-xs text-gray-400">{idx + 1}</td>
                {headers.map(h => {
                  const isProduct = PRODUCT_KEYS.includes(h.toLowerCase());
                  const isPhone = phoneCol && h === phoneCol;
                  const val = row[h] || '—';
                  return (
                    <td key={h} className="px-3 py-2.5 max-w-[180px]">
                      {isPhone && delivered
                        ? <span className="text-xs font-bold text-green-700 bg-green-200 px-1.5 py-0.5 rounded">{val} ✓</span>
                        : isProduct
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
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="bg-white border-t px-6 py-2 text-xs text-gray-500 flex justify-between">
        <span>{filtered.length} / {rows.length} lignes affichées {phoneCol && <span className="text-green-600 font-bold ml-2">✓ Livrés: {rows.filter(r => isDelivered(r)).length}</span>}</span>
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

function ColisHistoryModal({ order, onClose }) {
  const [hist, setHist] = useState([]);
  React.useEffect(() => {
    const local = JSON.parse(localStorage.getItem(`order_history_${order.id}`) || '[]');
    if (local.length) setHist(local);
    supabase.from('order_history').select('*').eq('order_id', order.id).order('timestamp', { ascending: true })
      .then(({ data }) => {
        if (data?.length) {
          const mapped = data.map(r => ({ timestamp: r.timestamp, status: r.status, user: r.user_name }));
          setHist(mapped);
          localStorage.setItem(`order_history_${order.id}`, JSON.stringify(mapped));
        }
      });
  }, [order.id]);
  const displayHist = hist.length > 0 ? hist : [
    { timestamp: order.dateAdded || '—', status: order.status, user: 'Création' }
  ];
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-t-xl sm:rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">Historique du commande</h2>
            <p className="text-xs text-gray-400 mt-0.5">{order.id}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100"><X size={15} className="text-gray-400" /></button>
        </div>
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-800">{order.recipient?.name} // {order.recipient?.city} ({order.recipient?.phone})</p>
          <p className="text-xs text-gray-500 mt-0.5">{order.recipient?.address}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-2 text-left text-xs font-semibold text-gray-500">Date mise à jour</th>
                <th className="px-6 py-2 text-left text-xs font-semibold text-gray-500">État</th>
                <th className="px-6 py-2 text-left text-xs font-semibold text-gray-500">Utilisateur</th>
              </tr>
            </thead>
            <tbody>
              {displayHist.length === 0 && (
                <tr><td colSpan={3} className="px-6 py-6 text-center text-gray-400 text-xs">Aucun historique disponible</td></tr>
              )}
              {[...displayHist].reverse().map((h, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-2.5 text-xs text-gray-700">{h.timestamp}</td>
                  <td className="px-6 py-2.5"><Badge statusKey={h.status} /></td>
                  <td className="px-6 py-2.5 text-xs text-gray-700 font-medium">{h.user}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Fermer</button>
        </div>
      </div>
    </div>
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
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-800 text-sm font-semibold hover:bg-gray-50 transition-colors"
      >
        <span>{current?.label || value}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown list */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-2xl overflow-y-auto max-h-56">
          {sorted.map(s => (
            <button
              key={s.value} type="button"
              onClick={() => { onChange(s.value); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors
                ${s.value === value ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
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
  const [reportDate, setReportDate] = useState(order.reportDate || '');

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

          {newStatus === 'reporter' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date de rappel</label>
              <input
                type="date"
                value={reportDate}
                onChange={e => setReportDate(e.target.value)}
                className="w-full px-4 py-3 bg-white text-gray-800 rounded-lg text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          )}

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
            onClick={() => { onSave(order.id, newStatus, note, newStatus === 'reporter' ? reportDate : null); onClose(); }}
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
  { value: 'att_ramassage', label: 'En Attente Ramassage', color: '#f59e0b' },
  { value: 'expedier',      label: 'Expédié',              color: '#3b82f6' },
  { value: 'recu_livreur',  label: 'Reçu Par Livreur',     color: '#6366f1' },
  { value: 'livre',         label: 'Livré',                color: '#16a34a' },
  { value: 'change',        label: 'Échange',              color: '#0891b2' },
  { value: 'refuse',        label: 'Refusé',               color: '#ef4444' },
  { value: 'pas_rep_lv',    label: 'Pas Répondu (Liv.)',   color: '#9ca3af' },
  { value: 'pret_retour',   label: 'Prêt Retour',          color: '#7c3aed' },
  { value: 'dem_suivi',     label: 'Demande de Suivi',     color: '#d97706' },
  { value: 'injoignable',   label: 'Injoignable',          color: '#dc2626' },
  { value: 'manque_stock',  label: 'Manque de Stock',      color: '#b45309' },
];

function DeliveryStatusModal({ order, onClose, onSave }) {
  const ozTn = order.ozoneTracking || order.trackingNumber;
  const [status, setStatus] = useState(order.status);
  const [note, setNote] = useState('');
  const [ozoneState, setOzoneState] = useState('idle');
  const [ozoneData, setOzoneData] = useState(null);
  const [manualTn, setManualTn] = useState('');
  const current = DELIVERY_STATUSES.find(s => s.value === status);
  const localStatus = DELIVERY_STATUSES.find(s => s.value === order.status);

  useEffect(() => { fetchOzone(); }, []);

  async function fetchOzone(customTn) {
    setOzoneState('loading');
    try {
      let cfg = JSON.parse(localStorage.getItem('auzone_config') || '{}');
      if (!cfg.customerId || !cfg.apiKey) {
        try {
          const remote = await cloudGet('auzone_config');
          if (remote?.customerId && remote?.apiKey) {
            cfg = remote;
            localStorage.setItem('auzone_config', JSON.stringify(remote));
          }
        } catch {}
      }
      if (!cfg.customerId || !cfg.apiKey) { setOzoneState('no_config'); return; }
      const base = `https://api.ozonexpress.ma/customers/${cfg.customerId}/${cfg.apiKey}`;
      const tns = customTn
        ? [customTn]
        : [...new Set([ozTn, order.trackingNumber, order.id].filter(Boolean))];

      for (const tn of tns) {
        try {
          const body = new FormData();
          body.append('tracking-number', tn);
          const ozAbort = new AbortController();
          const ozTimeout = setTimeout(() => ozAbort.abort(), 10000);
          const [trackRes, infoRes] = await Promise.all([
            fetch(`${base}/tracking`, { method: 'POST', body, signal: ozAbort.signal }),
            fetch(`${base}/parcel-info`, { method: 'POST', body: (() => { const f = new FormData(); f.append('tracking-number', tn); return f; })(), signal: ozAbort.signal }),
          ]);
          clearTimeout(ozTimeout);
          const trackJson = trackRes.ok ? await trackRes.json() : null;
          const infoJson = infoRes.ok ? await infoRes.json() : null;
          const track = trackJson ? (trackJson['TRACKING'] || trackJson) : {};
          const parcel = infoJson ? (infoJson['PARCEL-INFO'] || infoJson) : {};
          if ((track['RESULT'] || '').toUpperCase() === 'ERROR' && (parcel['RESULT'] || '').toUpperCase() === 'ERROR') continue;

          const pick = (...keys) => {
            for (const src of [parcel, track]) {
              for (const k of keys) { if (src[k]) return src[k]; }
            }
            return '';
          };
          const parcelInfos = parcel['INFOS'] || parcel;
          const lastTrack = track['LAST_TRACKING'] || track['LAST-TRACKING'] || {};
          const ozStatus = lastTrack['STATUT'] || lastTrack['STATUS'] || parcelInfos['PARCEL-STATUS'] || parcelInfos['STATUS'] || track['STATUT'] || '';
          const histRaw = track['HISTORY'] || track['PARCEL-HISTORY'] || track['history'] || {};
          const histList = Array.isArray(histRaw) ? histRaw : Object.values(histRaw);

          if (!ozStatus && histList.length === 0) continue;

          const realTn = parcelInfos['TRACKING-NUMBER'] || track['TRACKING-NUMBER'] || tn;
          if (realTn && realTn !== order.ozoneTracking) {
            onSave(order.id, order.status, '', realTn);
          }

          let deliveryPerson = '';
          let deliveryPhone = '';
          for (const h of histList) {
            const raw = h['COMMENT'] || '';
            const c = raw.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
            const phoneM = c.match(/T[ée]l[ée]phone\s*:?\s*(0[0-9]{9})/i);
            if (phoneM) deliveryPhone = phoneM[1].trim();
            const nameM = c.match(/Livreur\s*:?\s*([A-Z][A-Za-zÀ-ÿ]+(?:\s+[A-Z][A-Za-zÀ-ÿ]+)*)/);
            if (nameM) deliveryPerson = nameM[1].trim();
          }

          setOzoneData({
            tracking: realTn,
            status: ozStatus,
            receiver: parcelInfos['RECEIVER'] || parcelInfos['RECIPIENT-NAME'] || '',
            phone: parcelInfos['PHONE'] || parcelInfos['RECIPIENT-PHONE'] || '',
            city: parcelInfos['CITY_NAME'] || parcelInfos['CITY'] || '',
            cod: parcelInfos['PRICE'] || parcelInfos['COD'] || '',
            history: histList,
            deliveryPerson,
            deliveryPhone,
          });
          if (deliveryPerson || deliveryPhone) {
            try { localStorage.setItem(`ozone_dp_${order.id}`, JSON.stringify({ name: deliveryPerson, phone: deliveryPhone })); cloudSet(`ozone_dp_${order.id}`, { name: deliveryPerson, phone: deliveryPhone }); } catch {}
          }
          if (ozStatus) onSave(order.id, order.status, '', realTn, ozStatus);
          setOzoneState('ok');
          return;
        } catch {}
      }
      setOzoneState('not_found');
    } catch { setOzoneState('error'); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-t-xl sm:rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-100"><Truck size={15} className="text-amber-600" /></span>
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Livraison — {order.id}</h3>
              <p className="text-xs text-gray-400">{order.recipient?.name} — {order.recipient?.city}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={15} className="text-gray-400" /></button>
        </div>

        <div className="p-4 max-h-[70vh] overflow-y-auto space-y-3">
          {/* Local status - always visible, instant */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1.5">Statut actuel</p>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: localStatus?.color || '#f59e0b' }} />
              <span className="text-sm font-bold" style={{ color: localStatus?.color || '#f59e0b' }}>{localStatus?.label || order.status}</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">{order.dateUpdated || order.dateAdded}</p>
          </div>

          {/* Ozone section */}
          <div className="border border-amber-200 rounded-lg overflow-hidden">
            <div className="bg-amber-50 px-3 py-2 flex items-center justify-between">
              <span className="text-xs font-bold text-amber-700">Ozone Express</span>
              {ozoneState === 'idle' && (
                <div className="flex items-center gap-1 text-xs text-amber-600">
                  <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {ozoneState === 'loading' && (
                <div className="flex items-center gap-1 text-xs text-amber-600">
                  <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  Chargement...
                </div>
              )}
              {ozoneState === 'ok' && (
                <button onClick={() => fetchOzone()} className="text-[10px] text-amber-600 hover:underline">Actualiser</button>
              )}
            </div>

            <div className="px-3 py-2">
              {ozoneState === 'idle' && (
                <p className="text-xs text-gray-400 text-center py-2">Chargement...</p>
              )}

              {ozoneState === 'no_config' && (
                <p className="text-xs text-amber-600 text-center py-2">API non configurée. Allez dans Réglages → Ozon Express.</p>
              )}

              {(ozoneState === 'error' || ozoneState === 'not_found') && (
                <div className="py-2">
                  <p className="text-xs text-red-500 mb-2 text-center">Introuvable avec: {[ozTn, order.trackingNumber, order.id].filter(Boolean).join(', ')}</p>
                  <div className="flex gap-2">
                    <input
                      value={manualTn}
                      onChange={e => setManualTn(e.target.value)}
                      placeholder="Entrez le N° Ozone..."
                      className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-300"
                      onKeyDown={e => { if (e.key === 'Enter' && manualTn.trim()) fetchOzone(manualTn.trim()); }}
                    />
                    <button
                      onClick={() => manualTn.trim() && fetchOzone(manualTn.trim())}
                      disabled={!manualTn.trim()}
                      className="px-3 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-lg hover:bg-amber-600 disabled:opacity-40 transition"
                    >
                      OK
                    </button>
                  </div>
                </div>
              )}

              {ozoneState === 'ok' && ozoneData && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    <span className="text-sm font-bold text-green-700">{ozoneData.status}</span>
                  </div>
                  {ozoneData.tracking && <p className="text-[10px] text-gray-500">N° suivi: <span className="font-mono text-amber-700">{ozoneData.tracking}</span></p>}
                  {ozoneData.cod && <p className="text-[10px] text-gray-500">COD: <span className="font-semibold text-gray-700">{ozoneData.cod} DH</span></p>}
                  {ozoneData.history.length > 0 && (
                    <div className="mt-2 border-t border-gray-100 pt-2">
                      <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Historique</p>
                      <div className="relative pl-3 space-y-1.5">
                        <div className="absolute left-1 top-0 bottom-0 w-px bg-gray-200" />
                        {ozoneData.history.map((h, i) => (
                          <div key={i} className="relative">
                            <span className="absolute -left-[7px] w-2 h-2 rounded-full border border-white"
                              style={{ backgroundColor: i === 0 ? '#f59e0b' : '#d1d5db' }} />
                            <p className="text-[11px] font-semibold text-gray-700 pl-1">{h['STATUT'] || h['STATUS'] || h['status'] || ''}</p>
                            {(h['TIME_STR'] || h['DATE'] || h['date']) && <p className="text-[10px] text-gray-400 pl-1">{h['TIME_STR'] || h['DATE'] || h['date']}</p>}
                            {h['COMMENT'] && <p className="text-[10px] text-gray-400 pl-1">{h['COMMENT']}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Manual status change */}
          <details className="border border-gray-200 rounded-lg overflow-hidden">
            <summary className="bg-gray-50 px-3 py-2 text-xs font-bold text-gray-600 cursor-pointer hover:bg-gray-100 select-none">
              Changer le statut manuellement
            </summary>
            <div className="p-3 space-y-2">
              <div className="grid grid-cols-1 gap-1.5 max-h-44 overflow-y-auto pr-1">
                {DELIVERY_STATUSES.map(s => (
                  <button key={s.value} onClick={() => setStatus(s.value)}
                    className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs text-left transition-all border ${
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
          </details>
        </div>
      </div>
    </div>
  );
}

/* ── Bulk Action Bar for Colis ── */
function ColisBulkActionBar({ selected, setSelected, orders, setOrders, colis }) {
  const { statuses } = useStatuses();
  const [showStatus, setShowStatus] = useState(false);
  const [showLivreur, setShowLivreur] = useState(false);
  const statusRef = useRef(null);
  const livreurRef2 = useRef(null);

  const livreursList = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('livreurs') || '[]').filter(l => l.statut !== false); } catch { return []; }
  }, []);

  useEffect(() => {
    function handler(e) {
      if (statusRef.current && !statusRef.current.contains(e.target)) setShowStatus(false);
      if (livreurRef2.current && !livreurRef2.current.contains(e.target)) setShowLivreur(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedOrders = orders.filter(o => selected.includes(o.id));

  function getTs() {
    let tz; try { const raw = localStorage.getItem('system_timezone'); tz = raw ? JSON.parse(raw) : 'Africa/Casablanca'; } catch { tz = localStorage.getItem('system_timezone') || 'Africa/Casablanca'; }
    return new Date().toLocaleString('fr-FR', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '');
  }

  function bulkChangeStatus(newStatus) {
    const ts = getTs();
    setOrders(prev => prev.map(o => {
      if (!selected.includes(o.id)) return o;
      return { ...o, status: newStatus, dateUpdated: ts };
    }));
    setShowStatus(false);
    setSelected([]);
  }

  function bulkAssignLivreur(livreurName) {
    setOrders(prev => prev.map(o => {
      if (!selected.includes(o.id)) return o;
      return { ...o, recipient: { ...o.recipient, delivery: livreurName } };
    }));
    setShowLivreur(false);
    setSelected([]);
  }

  function bulkExport() {
    const data = selectedOrders;
    const header = ['ID','Tracking','Nom','Téléphone','Ville','Adresse','Livreur','Produit','Prix','Statut','Date ajout'];
    const csvRows = [header.join(',')];
    data.forEach(o => {
      const st = statuses.find(s => s.value === o.status);
      csvRows.push([
        o.id, o.trackingNumber || '', o.recipient?.name || '', o.recipient?.phone || '',
        o.recipient?.city || '', `"${(o.recipient?.address || '').replace(/"/g, '""')}"`,
        o.recipient?.delivery || '', (o.products?.[0]?.name || o.product?.name || ''),
        o.price || 0, st?.label || o.status, o.dateAdded || ''
      ].join(','));
    });
    const blob = new Blob(['﻿' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `colis_selection_${selected.length}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  function bulkPrintBordereau() {
    const _e = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const data = selectedOrders;
    const rows = data.map(o => `
      <tr>
        <td style="font-weight:bold;color:#1e3a8a">${_e(o.trackingNumber || o.id)}</td>
        <td>${_e(o.recipient?.name || '—')}</td>
        <td>${_e(o.recipient?.phone || '—')}</td>
        <td>${_e(o.recipient?.city || '—')}</td>
        <td>${_e(o.recipient?.address || '—')}</td>
        <td>${_e(o.products?.[0]?.name || o.product?.name || '—')}</td>
        <td style="font-weight:bold">${Number(o.price || 0).toFixed(2)} DH</td>
        <td>${_e(o.recipient?.delivery || '—')}</td>
      </tr>`).join('');
    const totalPrice = data.reduce((s, o) => s + (o.price || 0), 0);
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
    <title>Bordereau - ${data.length} colis</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; font-size: 12px; }
      h1 { font-size: 20px; color: #1e3a8a; margin-bottom: 4px; }
      .meta { color:#555; margin-bottom: 16px; font-size: 11px; }
      table { width:100%; border-collapse:collapse; margin-top:12px; }
      th { background:#1e3a8a; color:#fff; padding:6px 8px; text-align:left; font-size:10px; }
      td { padding:5px 8px; border-bottom:1px solid #e5e7eb; font-size:11px; }
      tr:nth-child(even) td { background:#f8fafc; }
      .total { margin-top:16px; text-align:right; font-size:14px; font-weight:bold; }
      @media print { button { display:none; } body { padding: 12px; } }
    </style></head><body>
    <h1>Bordereau de livraison</h1>
    <div class="meta">Date: <strong>${new Date().toLocaleDateString('fr-MA')}</strong> | Nombre de colis: <strong>${data.length}</strong></div>
    <table>
      <thead><tr><th>Tracking</th><th>Client</th><th>Tél</th><th>Ville</th><th>Adresse</th><th>Produit</th><th>Prix</th><th>Livreur</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="total">Total: ${totalPrice.toFixed(2)} DH</div>
    <script>window.onload=()=>window.print();</script>
    </body></html>`;
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  }

  function bulkPrintLabels() {
    const toPrint = colis.filter(o => selected.includes(o.id));
    if (toPrint.length) openLabelPage(toPrint);
  }

  return (
    <div className="bg-gray-900 border-t border-gray-700 px-6 py-3 flex items-center gap-3">
      <div className="flex items-center gap-2 mr-3">
        <span className="bg-blue-600 text-white text-xs font-black px-2.5 py-1 rounded-full">{selected.length}</span>
        <span className="text-sm font-semibold text-white">sélectionnée{selected.length > 1 ? 's' : ''}</span>
      </div>

      <div className="h-6 w-px bg-gray-600 mx-1" />

      {/* Change Status */}
      <div className="relative" ref={statusRef}>
        <button onClick={() => { setShowStatus(o => !o); setShowLivreur(false); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors">
          <Check size={13} /> Changer statut <ChevronDown size={11} />
        </button>
        {showStatus && (
          <div className="absolute bottom-full mb-2 left-0 bg-white border border-gray-200 rounded-xl shadow-2xl w-56 max-h-64 overflow-y-auto z-50">
            {DELIVERY_STATUSES.map(s => (
              <button key={s.value} onClick={() => bulkChangeStatus(s.value)}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 text-gray-700 border-b border-gray-50 last:border-0 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Assign Livreur */}
      <div className="relative" ref={livreurRef2}>
        <button onClick={() => { setShowLivreur(o => !o); setShowStatus(false); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors">
          <Truck size={13} /> Livreur <ChevronDown size={11} />
        </button>
        {showLivreur && (
          <div className="absolute bottom-full mb-2 left-0 bg-white border border-gray-200 rounded-xl shadow-2xl w-56 max-h-64 overflow-y-auto z-50">
            {livreursList.length === 0 && <div className="px-4 py-3 text-xs text-gray-400">Aucun livreur</div>}
            {livreursList.map(l => (
              <button key={l.id} onClick={() => bulkAssignLivreur(l.nom)}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 text-gray-700 border-b border-gray-50 last:border-0">
                {l.nom}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Print Bordereau */}
      <button onClick={bulkPrintBordereau}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold transition-colors">
        <Printer size={13} /> Bordereau
      </button>

      {/* Print Labels */}
      <button onClick={bulkPrintLabels}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition-colors">
        <Printer size={13} /> Étiquettes
      </button>

      {/* Export CSV */}
      <button onClick={bulkExport}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-xs font-semibold transition-colors">
        <Download size={13} /> Exporter
      </button>

      <div className="ml-auto">
        <button onClick={() => setSelected([])}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-500 text-gray-300 hover:bg-gray-700 rounded-lg text-xs font-semibold transition-colors">
          <X size={13} /> Annuler
        </button>
      </div>
    </div>
  );
}

/* ── Main page ── */
const COLIS_PIPELINE = ['ramasse','att_ramassage','expedier','recu_livreur','livre','change','refuse','annule','pas_rep_lv','pret_retour','dem_suivi','en_suivi','retour_recu','echange_recu'];
const isCasa = (city) => {
  if (!city) return false;
  const c = city.toLowerCase().replace(/[\s\-]/g, '');
  return ['casa','casablanca','كازا','كازابلانكا','الدارالبيضاء','الدار البيضاء','dar el beida','darelbeida'].some(k => c.includes(k.replace(/[\s\-]/g, '')));
};

export default function ListeColisPage({ orders, setOrders, isLoading }) {
  const [tab, setTab] = useState('colis');
  const [search, setSearch] = useState('');
  const [pgPage, setPgPage] = useState(1);
  const [pgPer, setPgPer] = useState(10);
  const [filterOpen, setFilterOpen] = useState(false);
  const [livreurOpen, setLivreurOpen] = useState(false);
  const livreurRef = useRef(null);
  const [whatsappPopup, setWhatsappPopup] = useState(null);
  const [sentLivreurInfo, setSentLivreurInfo] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('victoury_sent_livreur') || '[]')); } catch { return new Set(); }
  });
  useEffect(() => {
    cloudGet('victoury_sent_livreur').then(remote => {
      if (Array.isArray(remote) && remote.length) {
        setSentLivreurInfo(prev => {
          const merged = new Set([...prev, ...remote]);
          localStorage.setItem('victoury_sent_livreur', JSON.stringify([...merged]));
          return merged;
        });
      }
    });
  }, []);
  const { statuses } = useStatuses();
  const emptyFilter = { livreur: '', ville: '', produit: '', dateFrom: '', dateTo: '', status: '' };
  const [filterForm, setFilterForm] = useState(emptyFilter);
  const [appliedFilter, setAppliedFilter] = useState(emptyFilter);
  const isFilterActive = Object.values(appliedFilter).some(v => v !== '');
  function applyFilter() { setAppliedFilter({ ...filterForm }); setFilterOpen(false); }
  function resetFilter() { setFilterForm(emptyFilter); setAppliedFilter(emptyFilter); setLivreurOpen(false); }

  /* ── Saved filters ── */
  const [savedFilters, setSavedFilters] = useState(() => {
    try { return JSON.parse(localStorage.getItem('victoury_saved_filters') || '[]'); } catch { return []; }
  });
  const [saveFilterName, setSaveFilterName] = useState('');
  const [savedFilterDropdown, setSavedFilterDropdown] = useState(false);
  const savedFilterRef = useRef(null);
  function persistSavedFilters(list) { localStorage.setItem('victoury_saved_filters', JSON.stringify(list)); setSavedFilters(list); }
  function handleSaveFilter() {
    const name = saveFilterName.trim();
    if (!name) return;
    const entry = { name, filter: { ...filterForm }, id: Date.now() };
    const list = [...savedFilters.filter(f => f.name !== name), entry];
    persistSavedFilters(list);
    setSaveFilterName('');
  }
  function loadSavedFilter(entry) {
    setFilterForm(entry.filter);
    setAppliedFilter(entry.filter);
    setSavedFilterDropdown(false);
  }
  function deleteSavedFilter(id) {
    persistSavedFilters(savedFilters.filter(f => f.id !== id));
  }
  React.useEffect(() => {
    if (!savedFilterDropdown) return;
    function handler(e) { if (savedFilterRef.current && !savedFilterRef.current.contains(e.target)) setSavedFilterDropdown(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [savedFilterDropdown]);

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
  const [historyOrder, setHistoryOrder] = useState(null);
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

  useEffect(() => {
    cloudGet('victoury_recu_ids').then(val => {
      if (Array.isArray(val)) {
        const merged = new Set([...recuIds, ...val]);
        localStorage.setItem('victoury_recu_ids', JSON.stringify([...merged]));
        setRecuIds(merged);
      }
    });
    cloudGet('victoury_manual_facture').then(val => {
      if (Array.isArray(val)) {
        const merged = new Set([...manualFacture, ...val]);
        localStorage.setItem('victoury_manual_facture', JSON.stringify([...merged]));
        setManualFacture(merged);
      }
    });
  }, []);

  function toggleRecu(orderId) {
    setRecuIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) { next.delete(orderId); } else { next.add(orderId); }
      localStorage.setItem('victoury_recu_ids', JSON.stringify([...next]));
      cloudSet('victoury_recu_ids', [...next]);
      return next;
    });
  }

  function sendLivreurInfo(order) {
    const wa = buildWhatsappMessage(order, 'expedier');
    if (wa) setWhatsappPopup({ ...wa, markSent: true });
  }

  function markLivreurSent(orderId) {
    setSentLivreurInfo(prev => {
      const next = new Set(prev);
      next.add(orderId);
      localStorage.setItem('victoury_sent_livreur', JSON.stringify([...next]));
      cloudSet('victoury_sent_livreur', [...next]);
      return next;
    });
  }

  const [paidOrderIds, setPaidOrderIds] = useState(() => {
    try {
      const factures = JSON.parse(localStorage.getItem('victoury_factures') || '[]');
      const ids = new Set();
      factures.forEach(f => { if (f.statut === 'paye') (f.colis || []).forEach(c => ids.add(c.orderId)); });
      return ids;
    } catch { return new Set(); }
  });

  useEffect(() => {
    function onStorage(e) {
      if (e.key === 'victoury_factures') {
        try {
          const factures = JSON.parse(e.newValue || '[]');
          const ids = new Set();
          factures.forEach(f => { if (f.statut === 'paye') (f.colis || []).forEach(c => ids.add(c.orderId)); });
          setPaidOrderIds(ids);
        } catch {}
      }
    }
    window.addEventListener('storage', onStorage);
    const interval = setInterval(() => {
      try {
        const factures = JSON.parse(localStorage.getItem('victoury_factures') || '[]');
        const ids = new Set();
        factures.forEach(f => { if (f.statut === 'paye') (f.colis || []).forEach(c => ids.add(c.orderId)); });
        setPaidOrderIds(ids);
      } catch {}
    }, 5000);
    return () => { window.removeEventListener('storage', onStorage); clearInterval(interval); };
  }, []);

  const facturedIds = useMemo(() => new Set([...manualFacture, ...paidOrderIds]), [manualFacture, paidOrderIds]);

  function toggleFacture(orderId) {
    setManualFacture(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) { next.delete(orderId); } else { next.add(orderId); }
      localStorage.setItem('victoury_manual_facture', JSON.stringify([...next]));
      cloudSet('victoury_manual_facture', [...next]);
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
      if (af.status && o.status !== af.status) return false;
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

  const maxPage = Math.max(1, Math.ceil(colis.length / pgPer));
  useEffect(() => {
    if (pgPage > maxPage && colis.length > 0) setPgPage(maxPage);
  }, [pgPage, maxPage, colis.length]);
  const pagedColis = useMemo(() => paginate(colis, Math.min(pgPage, maxPage), pgPer), [colis, pgPage, maxPage, pgPer]);

  function getTs() {
    let tz; try { const raw = localStorage.getItem('system_timezone'); tz = raw ? JSON.parse(raw) : 'Africa/Casablanca'; } catch { tz = localStorage.getItem('system_timezone') || 'Africa/Casablanca'; }
    return new Date().toLocaleString('fr-FR', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '');
  }

  function handleStatusSave(orderId, newStatus, note, reportDate) {
    const ts = getTs();
    const order = orders.find(o => o.id === orderId);
    const leavePipeline = !COLIS_PIPELINE.includes(newStatus);
    setOrders((prev) => prev.map((o) => {
      if (o.id !== orderId) return o;
      const prevNote = o.note || '';
      const addedNote = note ? `\nNote interne: ${note}` : '';
      const updated = { ...o, status: newStatus, dateUpdated: ts, note: prevNote + addedNote, reportDate: newStatus === 'reporter' ? (reportDate || o.reportDate) : null };
      if (leavePipeline) { updated.validated = false; updated.trackingNumber = null; }
      return updated;
    }));
    if (order && order.recipient?.phone) {
      const wa = buildWhatsappMessage(order, newStatus);
      if (wa) setWhatsappPopup({ ...wa });
    }
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

  function exportColisCSV(data) {
    const header = ['ID','Tracking','Nom','Téléphone','Ville','Adresse','Livreur','Produit','Prix','Statut','Date ajout'];
    const csvRows = [header.join(',')];
    data.forEach(o => {
      const st = statuses.find(s => s.value === o.status);
      csvRows.push([
        o.id, o.trackingNumber || '', o.recipient?.name || '', o.recipient?.phone || '',
        o.recipient?.city || '', `"${(o.recipient?.address || '').replace(/"/g, '""')}"`,
        o.recipient?.delivery || '', (o.products?.[0]?.name || o.product?.name || ''),
        o.price || 0, st?.label || o.status, o.dateAdded || ''
      ].join(','));
    });
    const blob = new Blob(['﻿' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `colis_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

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
          <div className="relative flex items-center flex-1 max-w-xs">
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une commande..."
              className="w-full pl-3 pr-10 py-1.5 border border-gray-300 rounded-l-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <button className="px-3 py-[7px] bg-blue-600 text-white rounded-r-md hover:bg-blue-700 transition">
              <Search size={16} />
            </button>
          </div>
        )}
        {tab === 'colis' && (<>
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
          <button onClick={() => exportColisCSV(colis)} className="p-2 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50" title="Exporter CSV">
            <Download size={14} />
          </button>
          <button onClick={() => {
            const toPrint = selected.length > 0 ? colis.filter(o => selected.includes(o.id)) : colis;
            if (toPrint.length === 0) return;
            openLabelPage(toPrint);
          }} className="p-2 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50" title="Imprimer étiquettes">
            <Printer size={14} />
          </button>
        </>)}
      </div>

      {/* Advanced Filter Panel */}
      {filterOpen && tab === 'colis' && (() => {
        const livreursList = (() => { try { return JSON.parse(localStorage.getItem('livreurs') || '[]'); } catch { return []; } })();
        const livFiltered = livreursList.filter(l => l.statut !== false && (!filterForm.livreur || l.nom.toLowerCase().includes(filterForm.livreur.toLowerCase())));
        return (
          <div className="border-b border-gray-200 shadow-sm">
            {/* Dark header */}
            <div className="bg-gray-800 px-6 py-2.5 flex items-center justify-between">
              <span className="font-bold text-white text-sm tracking-wide">Filtre avancé</span>
              <button onClick={() => setFilterOpen(false)} className="text-gray-400 hover:text-white transition"><X size={14} /></button>
            </div>
            {/* Filter body */}
            <div className="bg-white px-6 py-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {/* État */}
                <div>
                  <label className="block text-xs text-gray-500 font-semibold mb-1">État</label>
                  <select
                    value={filterForm.status || ''}
                    onChange={e => setFilterForm(p => ({ ...p, status: e.target.value }))}
                    className="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:border-blue-400"
                  >
                    <option value="">Tous les états</option>
                    {statuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                {/* Livreurs — autocomplete */}
                <div ref={livreurRef} className="relative">
                  <label className="block text-xs text-gray-500 font-semibold mb-1">Livreurs</label>
                  <div className="relative">
                    <input
                      value={filterForm.livreur}
                      onChange={e => { setFilterForm(p => ({ ...p, livreur: e.target.value })); setLivreurOpen(true); }}
                      onFocus={() => setLivreurOpen(true)}
                      placeholder="Rechercher un..."
                      className="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400 pr-8"
                    />
                    <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-blue-500" />
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
                    <input value={filterForm.ville} onChange={e => setFilterForm(p => ({ ...p, ville: e.target.value }))} placeholder="Rechercher une..." className="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400 pr-8" />
                    <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-blue-500" />
                  </div>
                </div>
                {/* Produits */}
                <div>
                  <label className="block text-xs text-gray-500 font-semibold mb-1">Produits</label>
                  <div className="relative">
                    <input value={filterForm.produit} onChange={e => setFilterForm(p => ({ ...p, produit: e.target.value }))} placeholder="Rechercher un..." className="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400 pr-8" />
                    <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-blue-500" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3">
                {/* Date d'ajout */}
                <div>
                  <label className="block text-xs text-gray-500 font-semibold mb-1">Date d'ajout</label>
                  <div className="flex gap-1">
                    <input type="date" value={filterForm.dateFrom} onChange={e => setFilterForm(p => ({ ...p, dateFrom: e.target.value }))} className="flex-1 bg-white border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-blue-400" placeholder="Sélectionner une plage" />
                  </div>
                </div>
                {/* Date de mise à jour */}
                <div>
                  <label className="block text-xs text-gray-500 font-semibold mb-1">Date de mise à jour</label>
                  <div className="flex gap-1">
                    <input type="date" value={filterForm.dateTo} onChange={e => setFilterForm(p => ({ ...p, dateTo: e.target.value }))} className="flex-1 bg-white border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-blue-400" placeholder="Sélectionner une plage" />
                  </div>
                </div>
                {/* Buttons */}
                <div className="col-span-2 flex items-end justify-end gap-2">
                  <button onClick={resetFilter} className="px-4 py-1.5 rounded bg-teal-500 hover:bg-teal-600 text-sm text-white font-semibold transition-colors">Réinitialiser</button>
                  <button onClick={applyFilter} className="px-4 py-1.5 rounded bg-gray-700 hover:bg-gray-800 text-sm text-white font-semibold transition-colors">Appliquer les filtres</button>
                </div>
              </div>
              {/* Saved filters row */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1.5 flex-1">
                  <input
                    value={saveFilterName}
                    onChange={e => setSaveFilterName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveFilter(); }}
                    placeholder="Nom du filtre..."
                    className="border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-blue-400 w-40"
                  />
                  <button
                    onClick={handleSaveFilter}
                    disabled={!saveFilterName.trim()}
                    className="flex items-center gap-1 px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-xs text-white font-semibold transition-colors disabled:opacity-40"
                  >
                    <BookmarkPlus size={12} /> Sauvegarder
                  </button>
                </div>
                {savedFilters.length > 0 && (
                  <div ref={savedFilterRef} className="relative">
                    <button
                      onClick={() => setSavedFilterDropdown(o => !o)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded border border-indigo-300 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition-colors"
                    >
                      <Bookmark size={12} /> Filtres sauvegardés ({savedFilters.length}) <ChevronDown size={10} />
                    </button>
                    {savedFilterDropdown && (
                      <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[200px] max-h-48 overflow-y-auto">
                        {savedFilters.map(sf => (
                          <div key={sf.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                            <button
                              onMouseDown={() => loadSavedFilter(sf)}
                              className="text-sm text-gray-800 font-medium text-left flex-1 truncate"
                            >
                              {sf.name}
                            </button>
                            <button
                              onMouseDown={() => deleteSavedFilter(sf.id)}
                              className="p-1 text-gray-400 hover:text-red-500 transition-colors ml-2 shrink-0"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {tab === 'sheet' && <SheetImportSection orders={orders} setOrders={setOrders} />}

      {/* Table */}
      <div className={`flex-1 overflow-auto ${tab === 'sheet' ? 'hidden' : ''}`}>
        <table className="w-full text-sm border-collapse min-w-[900px] hidden md:table">
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
        </table>
        <div className="hidden md:block" style={pagedColis.length > 50 ? { maxHeight: '600px', overflowY: 'auto' } : undefined}>
        <table className="w-full text-sm border-collapse min-w-[900px]">
          <tbody className="divide-y divide-gray-50">
            {colis.length === 0 ? (
              <tr><td colSpan={10} className="py-16 text-center text-gray-400 text-sm">Aucun colis dans le pipeline</td></tr>
            ) : pagedColis.map((o) => {
              const note = (o.note || '').replace('Note interne: ', '').trim();
              const delivery = o.recipient?.delivery || '—';
              return (
                <tr key={o.id} className={`transition-colors ${selected.includes(o.id) ? 'bg-indigo-50 border-l-[3px] border-indigo-500' : isCasa(o.recipient?.city) ? 'bg-sky-50/70 border-l-[3px] border-sky-400 hover:bg-sky-100/60' : 'hover:bg-gray-50 border-l-[3px] border-transparent'}`}>
                  {/* Checkbox */}
                  <td className="px-4 py-3 w-8">
                    <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggleSelect(o.id)} className="w-4 h-4 rounded" />
                  </td>
                  {/* Destinataire */}
                  <td className="px-4 py-4 min-w-[220px]">
                    <div className="text-sm font-bold text-orange-600 font-mono mb-1">{o.trackingNumber || o.id}</div>
                    <div className="text-base font-bold text-gray-900 max-w-[220px] truncate">{o.recipient.name}</div>
                    <div className="text-sm text-gray-500 mt-0.5">{o.recipient.address}</div>
                    <div className="text-sm font-bold text-gray-800">{o.recipient.city}</div>
                    <PhoneChip phone={o.recipient.phone} allOrders={orders} />
                    {delivery !== '—' && (
                      <div className="mt-1.5 flex items-center gap-1 text-xs font-medium text-gray-500">
                        <Truck size={11} />
                        <span>{delivery}</span>
                      </div>
                    )}
                    {o.trackingNumber && (
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-green-600 font-mono font-semibold">
                        <Truck size={10} />
                        <span>{o.trackingNumber}</span>
                      </div>
                    )}
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

                    {/* Send livreur info button — only when dispatch person info exists */}
                    {(o.status === 'expedier' || o.status === 'recu_livreur') && o.recipient?.phone && (() => {
                      try {
                        const dp = JSON.parse(localStorage.getItem(`ozone_dp_${o.id}`) || '{}');
                        return !!(dp.name || dp.phone);
                      } catch { return false; }
                    })() && (
                      <button
                        onClick={() => sendLivreurInfo(o)}
                        className={`mt-1 text-[10px] px-1.5 py-0.5 rounded-full border font-semibold transition-colors ${
                          sentLivreurInfo.has(o.id)
                            ? 'bg-green-100 text-green-700 border-green-300'
                            : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                        }`}
                      >
                        {sentLivreurInfo.has(o.id) ? '✓ Envoyé' : '📩 Envoyer info'}
                      </button>
                    )}

                    {/* Sub-status: facture toggle (persisted in localStorage) */}
                    {o.status === 'livre' && (
                      <button
                        onClick={() => toggleFacture(o.id)}
                        className={`mt-1 text-[10px] px-1.5 py-0.5 rounded-full border font-semibold transition-colors ${
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
                        className={`mt-1 text-[10px] px-1.5 py-0.5 rounded-full border font-semibold transition-colors ${
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
                  <td className="px-4 py-3 max-w-[250px]">
                    {note && <span className="text-sm text-gray-700 font-medium whitespace-pre-wrap">Note interne:<br/>{note}</span>}
                  </td>

                  {/* LIV */}
                  <td className="px-4 py-3">
                    {delivery !== '—' ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold px-2 py-1 rounded bg-amber-100 text-amber-700">{delivery}</span>
                        {o.ozoneLastStatus && (() => {
                          const ls = (o.ozoneLastStatus || '').toLowerCase();
                          const ozColor = ls.includes('livr') ? 'bg-green-100 text-green-700'
                            : ls.includes('refus') ? 'bg-red-100 text-red-700'
                            : ls.includes('ramassage') || ls.includes('attente') ? 'bg-amber-100 text-amber-700'
                            : ls.includes('expédi') || ls.includes('recu') || ls.includes('reçu') ? 'bg-blue-100 text-blue-700'
                            : ls.includes('retour') ? 'bg-gray-200 text-gray-700'
                            : 'bg-teal-100 text-teal-700';
                          return <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${ozColor}`}>{o.ozoneLastStatus}</span>;
                        })()}
                      </div>
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
                      <button
                        onClick={() => setHistoryOrder(o)}
                        className="p-1.5 rounded bg-purple-100 text-purple-600 hover:bg-purple-200 transition-colors"
                        title="Historique"
                      >
                        <Clock size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>

        {/* Mobile card view */}
        <div className="md:hidden">
          {colis.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">Aucun colis dans le pipeline</div>
          ) : pagedColis.map((o) => (
            <div key={o.id} className={`bg-white border border-gray-200 rounded-lg p-3 mb-2 mx-3 ${selected.includes(o.id) ? 'ring-2 ring-indigo-400 bg-indigo-50' : isCasa(o.recipient?.city) ? 'border-sky-300 bg-sky-50/70' : ''}`}>
              {/* Top row: checkbox + tracking + badge */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggleSelect(o.id)} className="w-4 h-4 rounded" />
                  <span className="font-mono text-orange-600 font-bold text-sm">{o.trackingNumber || o.id}</span>
                </div>
                <button onClick={() => setEditOrder(o)} className="flex items-center gap-1">
                  <Badge statusKey={o.status} />
                  <ChevronDown size={10} className="text-gray-400" />
                </button>
              </div>
              {/* Middle: client + city */}
              <div className="mb-2">
                <div className="font-bold text-gray-900 text-sm truncate">{o.recipient.name}</div>
                <div className="text-xs text-gray-500">{o.recipient.phone}</div>
                <div className="font-bold text-gray-800 text-xs">{o.recipient.city}</div>
              </div>
              {/* Bottom: price + actions */}
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-800 text-sm">{Number(o.price || 0).toFixed(2)} DH</span>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setEditOrderFull(o)} className="p-1.5 rounded bg-blue-100 text-blue-600 hover:bg-blue-200" title="Modifier">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => setDeliveryOrder(o)} className="p-1.5 rounded bg-amber-100 text-amber-600 hover:bg-amber-200" title="Livraison">
                    <Truck size={13} />
                  </button>
                  <button onClick={() => setHistoryOrder(o)} className="p-1.5 rounded bg-purple-100 text-purple-600 hover:bg-purple-200" title="Historique">
                    <Clock size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {tab === 'colis' && (
        <Pagination total={colis.length} page={pgPage} perPage={pgPer} onPageChange={setPgPage} onPerPageChange={setPgPer} />
      )}

      {tab === 'colis' && selected.length > 0 && (
        <ColisBulkActionBar
          selected={selected}
          setSelected={setSelected}
          orders={orders}
          setOrders={setOrders}
          colis={colis}
        />
      )}

      {editOrder && (
        <StatusModal
          order={editOrder}
          onClose={() => setEditOrder(null)}
          onSave={(id, status, note, reportDate) => { handleStatusSave(id, status, note, reportDate); setEditOrder(null); }}
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
          onSave={(id, newStatus, newNote, newOzTn, ozoneLastStatus) => {
            if (newOzTn || ozoneLastStatus) {
              setOrders(prev => prev.map(o => o.id === id ? { ...o, ...(newOzTn ? { ozoneTracking: newOzTn } : {}), ...(ozoneLastStatus ? { ozoneLastStatus } : {}), ...(newNote !== '' || newStatus !== o.status ? { status: newStatus } : {}) } : o));
            }
            if (newNote !== '' || newStatus !== deliveryOrder?.status) {
              handleStatusSave(id, newStatus, newNote);
            }
            if (!newOzTn) setDeliveryOrder(null);
          }}
        />
      )}

      {historyOrder && (
        <ColisHistoryModal order={historyOrder} onClose={() => setHistoryOrder(null)} />
      )}

      {/* WhatsApp Notification Popup */}
      {whatsappPopup && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-green-50">
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-green-600 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.61.61l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.37 0-4.567-.816-6.3-2.183l-.44-.348-2.865.96.96-2.865-.348-.44A9.965 9.965 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                <span className="font-bold text-green-800 text-sm">Envoyer WhatsApp</span>
              </div>
              <button onClick={() => setWhatsappPopup(null)} className="p-1 hover:bg-gray-100 rounded"><X size={15} className="text-gray-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-gray-500">Client: <span className="font-bold text-gray-800">{whatsappPopup.name}</span> — {whatsappPopup.orderId}</p>
              <textarea
                value={whatsappPopup.msg}
                onChange={e => setWhatsappPopup(p => ({ ...p, msg: e.target.value }))}
                rows={4}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setWhatsappPopup(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  Ignorer
                </button>
                <button
                  onClick={() => {
                    const isAndroid = /android/i.test(navigator.userAgent);
                    if (isAndroid) {
                      window.location.href = `intent://send/${whatsappPopup.phone}#Intent;scheme=whatsapp;package=com.whatsapp.w4b;S.text=${encodeURIComponent(whatsappPopup.msg)};end`;
                    } else {
                      window.open(`https://api.whatsapp.com/send?phone=${whatsappPopup.phone}&text=${encodeURIComponent(whatsappPopup.msg)}`, '_blank');
                    }
                    if (whatsappPopup.markSent) markLivreurSent(whatsappPopup.orderId);
                    setWhatsappPopup(null);
                  }}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                  Envoyer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
