import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, ChevronDown, Upload, FileSpreadsheet, Trash2, Phone, Truck } from 'lucide-react';
import { cloudGet, cloudSet } from '../../lib/cloudSettings';
import { normalizePhone } from '../PhoneChip';
import { useToast } from '../Toast';
import { mapToAppStatus } from '../../lib/sheetStatus';
import { hasHeaderRow, detectColumns, pickStatusHeader } from '../../lib/sheetDetect';


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

  const firstCells = splitCSVLine(lines[0]);
  const headerful = hasHeaderRow(firstCells);
  // Sans ligne d'entêtes : on génère col1..colN et la 1ère ligne devient une donnée
  const headers = headerful ? firstCells : firstCells.map((_, i) => `col${i + 1}`);
  const dataLines = headerful ? lines.slice(1) : lines;
  const rows = dataLines.filter(l => l.trim()).map((line, idx) => {
    const vals = splitCSVLine(line);
    const obj = { _id: `gs-${Date.now()}-${idx}`, _status: '' };
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  });
  return { headers, rows, headerful };
}


export default function SheetImportSection({ orders = [], setOrders }) {
  const toast = useToast();
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

  /* Télécharge un modèle CSV avec les bons entêtes + 2 exemples */
  function downloadTemplate() {
    const headers = ['code','nom','phone','adresse','prix','ville','produit','livreur','date','taille','note livraison','note interne','confirmation','statut livraison'];
    const examples = [
      ['MIMA3001','Yassmine Kzaz','0652758903','Hay Anza rue 12','250','Agadir','Ensemble Sport Noir','Ozon Express','2026-05-16','XL','Appeler avant livraison','msg','confirme','livre'],
      ['MIMA3002','Ahmed Alaoui','0661472363','Bd Zerktouni imm 4','300','Casablanca','Pack Sport Bleu','Karim','2026-05-16','L','par WhatsApp','','confirme','retour'],
      ['MIMA3003','Salma Bennani','0709015213','Quartier Riad','199','Rabat','Ensemble Sport Rouge','Ozon Express','2026-05-17','M','','client pas dispo','annule',''],
    ];
    const esc = (v) => /[",;\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v;
    const csv = '﻿' + [headers, ...examples].map(r => r.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'victoury_modele_commandes.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      let text = ev.target.result;
      if (text.includes('\t') && !text.includes(',') && !text.includes(';')) {
        text = text.split('\n').map(l => l.split('\t').map(c => c.includes(',') ? `"${c}"` : c).join(',')).join('\n');
      }
      const { headers: h, rows: r, headerful } = parseCSV(text);
      if (!h.length) { toast.error('Fichier non reconnu.'); return; }
      // Avec entêtes : on se fie aux noms de colonnes. Sans entêtes : détection par le contenu.
      const map = headerful
        ? {}
        : Object.fromEntries(Object.entries(detectColumns(h, r)).filter(([, v]) => v));
      setColMap(map);
      setHeaders(h);
      setRows(r);
      const gsData = { headers: h, rows: r, colMap: map };
      localStorage.setItem('gs_import', JSON.stringify(gsData));
      cloudSet('gs_import', gsData);
      toast.success(`${r.length} ligne(s) chargée(s) — colonnes détectées automatiquement.`);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  }

  /* Ajustement manuel (secours) si une colonne est mal détectée */
  function openMapping() {
    setPendingData({ headers, rows });
    setMappingOpen(true);
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
  const STATUS_KEYS = ['statut','status','etat','état','situation','etatcommande','statutcommande','statutlivraison'];
  const NOTE_LIV_KEYS = ['notelivraison','notedelivraison','notelivreur','remarquelivraison','commentairelivraison','noteliv'];
  const LIVREUR_KEYS = ['livreur','livreu','societe','société','company','transporteur','coursier','livraisonpar','delivery'];

  const norm = (h) => h.toLowerCase().replace(/[^a-zàâéèêëïîôùûüç0-9]/g, '');
  const findCol = (field, keys) => {
    if (colMap[field]) return colMap[field];
    return headers.find(h => {
      const low = norm(h);
      // clés courtes (cod, id, tel…) : correspondance EXACTE seulement,
      // sinon "cod" attraperait "code", "id" attraperait plein de choses
      return keys.some(k => low === k || (k.length >= 4 && low.includes(k)));
    });
  };
  const phoneCol = findCol('phone', PHONE_KEYS);
  const nameCol = findCol('name', NAME_KEYS);
  const cityCol = findCol('city', CITY_KEYS);
  const addressCol = findCol('address', ADDRESS_KEYS);
  const priceCol = findCol('price', PRICE_KEYS);
  // Note de livraison (spécifique) détectée en premier, puis note interne (le reste)
  const noteLivCol = findCol('note_livraison', NOTE_LIV_KEYS);
  const noteIntCol = colMap['note'] || headers.find(h => {
    if (h === noteLivCol) return false;
    const low = norm(h);
    return low === 'note' || ['noteinterne','remarqueinterne','observation','commentaire','remarque'].some(k => low.includes(k));
  });
  const codeCol = findCol('code', CODE_KEYS);
  // Livreur / société de livraison (pour le calcul des frais dans les factures)
  const livreurCol = findCol('livreur', LIVREUR_KEYS);
  // Date de la commande (issue du Google Sheet) — affichée dans la colonne Date.
  const dateCol = colMap['date'] || headers.find(h => {
    const low = norm(h);
    return low === 'date' || ['datecommande','datecommand','dateajout','dateorder','ordredate','jour'].some(k => low.includes(k));
  });
  // Statut de LIVRAISON uniquement : mapping manuel > "statut livraison" > statut générique.
  // La colonne de confirmation est ignorée — seule la livraison remonte dans la Liste des Colis.
  const statusCol = pickStatusHeader(headers) || colMap['status'];


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
      // Statut : uniquement la colonne LIVRAISON (celle qui remonte dans la Liste des Colis)
      // → choix manuel → statut global. La colonne de confirmation est volontairement ignorée.
      const rowStatus = (statusCol && mapToAppStatus(row[statusCol]))
        || mapToAppStatus(row._status)
        || importStatus;
      const noteInterne = (noteIntCol && row[noteIntCol]) || '';
      const noteLivraison = (noteLivCol && row[noteLivCol]) || '';
      const livreur = (livreurCol && row[livreurCol]) || null;
      const ts = new Date().toLocaleString('fr-MA');
      // Date issue du Sheet si présente, sinon l'heure d'import.
      const sheetDate = (dateCol && String(row[dateCol] || '').trim()) || '';
      newOrders.push({
        id: code,
        recipient: { name, phone, city, address, delivery: livreur },
        product: { name: product, size: '', color: '', qty: 1, stock: 0 },
        products: product ? [{ name: product, size: '', color: '', qty: 1 }] : null,
        price,
        status: rowStatus,
        note: noteInterne,
        noteLivraison,
        dateAdded: sheetDate || ts,
        dateUpdated: ts,
        validated: true,
        trackingNumber: code,
      });
      existingIds.add(code);
    }
    if (!newOrders.length) { toast.warning('Tous ces colis existent déjà dans le pipeline.'); return; }
    setOrders(prev => [...newOrders, ...prev]);
    toast.success(`${newOrders.length} colis importé(s) vers Liste des colis.`);
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
    { key: 'livreur', label: 'Livreur',      icon: '🚚' },
    { key: 'status',  label: 'Statut',       icon: '🏷️' },
    { key: 'note',    label: 'Note interne', icon: '📝' },
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
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" onKeyDown={e => { if (e.key === 'Escape') { setMappingOpen(false); setPendingData(null); } }}>
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
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition">
              <Upload size={15} /> Importer fichier CSV
            </button>
            <button onClick={downloadTemplate}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-green-700 border border-green-300 rounded-lg text-sm font-semibold hover:bg-green-50 transition">
              <FileSpreadsheet size={15} /> Télécharger le modèle
            </button>
          </div>
          <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleFile} />
          <div className="text-gray-400 text-xs mt-5 max-w-md space-y-1">
            <p><strong>1.</strong> Téléchargez le modèle et remplissez vos commandes (gardez la 1ʳᵉ ligne des titres).</p>
            <p><strong>2.</strong> Dans Google Sheets : Fichier → Télécharger → CSV.</p>
            <p><strong>3.</strong> Importez le fichier ici — tout sera reconnu automatiquement.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {mappingModal}
      {/* Subheader */}
      <div className="bg-white border-b px-4 py-2 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
            className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
        </div>
        <div className="flex gap-2 ml-auto">
          <button onClick={downloadTemplate} title="Télécharger le modèle CSV"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-green-700 border border-green-300 rounded-lg text-xs font-semibold hover:bg-green-50 transition">
            <FileSpreadsheet size={13} /> Modèle
          </button>
          <button onClick={() => importToColis(filtered)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition">
            <Truck size={13} /> Importer vers Colis ({filtered.length})
          </button>
          <button onClick={openMapping} title="Ajuster les colonnes si une est mal détectée"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-200 transition">
            Colonnes
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
      <div className="flex-1 overflow-auto px-4 pb-4">
        <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
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
              <tr><td colSpan={headers.length + 3} className="py-16 text-center text-gray-400 text-sm">
                <div className="flex flex-col items-center gap-2">
                  <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  <span>Aucune ligne trouvée</span>
                </div>
              </td></tr>
            ) : filtered.map((row, idx) => {
              const delivered = isDelivered(row);
              return (
              <tr key={row._id} className={`border-b border-gray-100 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-100'} hover:bg-blue-50/30`}>
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

