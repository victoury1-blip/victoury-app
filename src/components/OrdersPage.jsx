import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Pagination, { paginate } from './Pagination';
import {
  Search,
  Filter,
  Printer,
  Upload,
  Download,
  Settings,
  Pencil,
  Clock,
  MessageCircle,
  Phone,
  MapPin,
  Truck,
  Loader2,
  CheckCircle2,
  XCircle,
  Copy,
  Plus,
  Check,
  ChevronDown,
  X,
  Trash2,
  History,
} from 'lucide-react';
import { statusConfig } from '../data/orders';
import OrderModal from './OrderModal';
import OzoneModal from './OzoneModal';
import StatusDropdown from './StatusDropdown';
import { useStatuses } from '../contexts/StatusContext';
import ContactModal from './ContactModal';
import { supabase } from '../lib/supabase';
import { loadProducts, loadProductsRemote } from '../data/products';

let _victCounter = null;

function initVictCounter(orders) {
  if (_victCounter !== null) return;
  let max = 0;
  for (const o of orders) {
    const m = (o.id || '').match(/^VICT(\d+)$/i);
    if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
  }
  const stored = parseInt(localStorage.getItem('vict_counter') || '0', 10);
  _victCounter = Math.max(max, stored);
}

function generateVictId() {
  _victCounter = (_victCounter || 0) + 1;
  localStorage.setItem('vict_counter', String(_victCounter));
  return 'VICT' + String(_victCounter).padStart(4, '0');
}

function getSysTz() { try { const raw = localStorage.getItem('system_timezone'); return raw ? JSON.parse(raw) : 'Africa/Casablanca'; } catch { return localStorage.getItem('system_timezone') || 'Africa/Casablanca'; } }
function now() {
  return new Date().toLocaleString('fr-FR', { timeZone: getSysTz(), day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '');
}

const tabs = [
  { id: 'a_confirmer', label: 'À Confirmer', status: ['nouveau', 'attente', 'en_attente', 'pas_rep', 'a_voir', 'interesse', 'photo_whatsapp', 'black_liste'] },
  { id: 'en_suivi', label: 'En Suivi', status: 'en_suivi' },
  { id: 'reporter', label: 'Reporté', status: 'reporter' },
  { id: 'confirme', label: 'Confirmé', status: 'confirme' },
];

const FALLBACK_CITIES = [
  { id: '1', name: 'Casablanca' }, { id: '2', name: 'Rabat' }, { id: '3', name: 'Fès' },
  { id: '4', name: 'Marrakech' }, { id: '5', name: 'Agadir' }, { id: '6', name: 'Tanger' },
  { id: '7', name: 'Meknès' }, { id: '8', name: 'Oujda' }, { id: '9', name: 'Tétouan' },
  { id: '10', name: 'Safi' }, { id: '11', name: 'Kénitra' }, { id: '12', name: 'El Jadida' },
  { id: '13', name: 'Béni Mellal' }, { id: '14', name: 'Témara' }, { id: '15', name: 'Mohammedia' },
  { id: '16', name: 'Nador' }, { id: '17', name: 'Khouribga' }, { id: '18', name: 'Settat' },
  { id: '19', name: 'Berrechid' }, { id: '20', name: 'Dar Bouazza' }, { id: '21', name: 'Boukkoura' },
  { id: '22', name: 'Sala Al Jadida' }, { id: '23', name: 'Tiznit' }, { id: '24', name: 'Larache' },
  { id: '25', name: 'Guercif' }, { id: '26', name: 'Sidi Slimane' }, { id: '27', name: 'Ouarzazate' },
  { id: '28', name: 'Errachidia' }, { id: '29', name: 'Taza' }, { id: '30', name: 'Khemisset' },
];

function getOzoneConfig() {
  try { return JSON.parse(localStorage.getItem('auzone_config') || '{}'); } catch { return {}; }
}

function resolveCityId(cityName, cities) {
  if (!cityName) return null;
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const n = norm(cityName);
  const exact = cities.find((c) => norm(c.name) === n);
  if (exact) return exact.id;
  const partial = cities.find((c) => norm(c.name).includes(n) || n.includes(norm(c.name)));
  return partial ? partial.id : null;
}

function Toggle({ checked, loading, onChange }) {
  return (
    <button
      onClick={() => !loading && onChange(!checked)}
      disabled={loading}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        loading ? 'bg-blue-300 cursor-wait' : checked ? 'bg-blue-500' : 'bg-gray-300'
      }`}
    >
      {loading
        ? <Loader2 size={11} className="absolute left-1/2 -translate-x-1/2 text-white animate-spin" />
        : <span
            className="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform"
            style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }}
          />}
    </button>
  );
}

function Toast({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 space-y-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm ${
            t.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {t.type === 'success'
            ? <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
            : <XCircle size={16} className="text-red-500 mt-0.5 shrink-0" />}
          <div className="flex-1">
            <p className="font-semibold">{t.title}</p>
            {t.body && <p className="text-xs mt-0.5 opacity-80">{t.body}</p>}
          </div>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 ml-1">×</button>
        </div>
      ))}
    </div>
  );
}

function isLight(hex) {
  if (!hex || hex.length < 7) return true;
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return (r*299+g*587+b*114)/1000 > 155;
}

function PhoneChip({ phone }) {
  const [open, setOpen] = useState(false);
  if (!phone) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 text-sm font-bold text-gray-900 hover:underline active:text-gray-600"
      >
        {phone}
      </button>
      {open && <ContactModal phone={phone} onClose={() => setOpen(false)} />}
    </>
  );
}

function StatusBadge({ status, reportDate }) {
  const { getLive } = useStatuses();
  const live = getLive(status);
  const color = live.color || '#6B7280';
  const light = isLight(color);
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="px-2.5 py-0.5 rounded text-xs font-semibold whitespace-nowrap"
        style={{ backgroundColor: color, color: light ? '#111' : '#fff' }}
      >
        {live.label || status}
      </span>
      {reportDate && (
        <span className="text-xs text-gray-500 flex items-center gap-1">
          <Clock size={10} /> {reportDate}
        </span>
      )}
    </div>
  );
}

/* ── Collapsible dark status picker for modal ── */
function StatusPicker({ value, onChange }) {
  const { statuses } = useStatuses();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const sorted = [...statuses].filter(s => s.showInCommandes !== false).sort((a, b) => a.order - b.order);
  const current = statuses.find(s => s.value === value);

  React.useEffect(() => {
    if (!open) return;
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-[#2d2d3a] border border-[#3f3f52] rounded-lg text-white text-sm font-semibold hover:bg-[#38384a] transition-colors"
      >
        <span>{current?.label || value}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#2d2d3a] border border-[#3f3f52] rounded-lg shadow-2xl overflow-y-auto max-h-56">
          {sorted.map(s => (
            <button
              key={s.value} type="button"
              onClick={() => { onChange(s.value); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${s.value === value ? 'bg-[#3a3a50] text-white' : 'text-gray-200 hover:bg-[#38384a]'}`}
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

/* ─── History helpers ─── */
function getUserDisplayName(email) {
  try {
    const profiles = JSON.parse(localStorage.getItem('user_profiles') || '[]');
    const p = profiles.find(u => u.email === email);
    return p ? `${p.name} (${p.role})` : (email || 'inconnu');
  } catch { return email || 'inconnu'; }
}

function recordHistory(orderId, status, user) {
  const key = `order_history_${orderId}`;
  const hist = JSON.parse(localStorage.getItem(key) || '[]');
  const ts = now();
  const entry = { timestamp: ts, status, user: getUserDisplayName(user) };
  hist.push(entry);
  localStorage.setItem(key, JSON.stringify(hist));
  supabase.from('order_history').insert({ order_id: orderId, status, user_name: entry.user, timestamp: ts }).then(() => {}).catch?.(() => {});
}

function HistoryModal({ order, onClose }) {
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
          <p className="text-sm font-semibold text-gray-800">{order.recipient.name} // {order.recipient.city} ({order.recipient.phone})</p>
          <p className="text-xs text-gray-500 mt-0.5">{order.recipient.address}</p>
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
                  <td className="px-6 py-2.5"><StatusBadge status={h.status} /></td>
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

function StatusChangeModal({ order, onClose, onSave }) {
  const { statuses } = useStatuses();
  const sorted = [...statuses].filter(s => s.showInCommandes !== false).sort((a, b) => a.order - b.order);
  const [newStatus, setNewStatus] = useState(order.status);
  const [note, setNote] = useState('');
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-800">Modifier le statut de la commande</h3>
          <button type="button" onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={16} className="text-gray-400" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nouveau statut</label>
            <select
              value={newStatus}
              onChange={e => setNewStatus(e.target.value)}
              className="w-full px-4 py-3 bg-white text-gray-800 rounded-lg text-sm font-semibold border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              {sorted.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Note interne</label>
            <textarea
              value={note} onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
              placeholder="Ajouter une note interne..."
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button type="button" onClick={onClose} className="px-5 py-3 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-200">Annuler</button>
          <button
            type="button"
            onClick={() => onSave(order.id, newStatus, note)}
            className="px-5 py-3 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 active:bg-blue-800"
          >Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage({ activeTab, setActiveTab, externalOrders, setExternalOrders, isLoading, onDeleteOrder, currentUser }) {
  const orders = externalOrders;
  useEffect(() => { if (orders.length) initVictCounter(orders); }, [orders]);
  function setOrders(updater) {
    setExternalOrders(updater);
  }
  const [search, setSearch] = useState('');
  const [pgPage, setPgPage] = useState(1);
  const [pgPer, setPgPer] = useState(10);
  const [selected, setSelected] = useState([]);
  const [editOrder, setEditOrder] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [ozoneOrder, setOzoneOrder] = useState(null);
  const [ozoneOpen, setOzoneOpen] = useState(false);
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [statusDropdown, setStatusDropdown] = useState(null); /* { order, anchor } */
  const [toasts, setToasts] = useState([]);
  const [modifiedIds, setModifiedIds] = useState(new Set());
  const [historyOrder, setHistoryOrder] = useState(null);

  /* ── Advanced filter ── */
  const [filterOpen, setFilterOpen] = useState(false);
  const [livreurOpen, setLivreurOpen] = useState(false);
  const livreurRef = useRef(null);
  const emptyFilter = { livreur: '', ville: '', produit: '', dateFrom: '', dateTo: '', status: '' };
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

  const currentStatusRaw = tabs.find((t) => t.id === activeTab)?.status || 'nouveau';
  const currentStatuses = Array.isArray(currentStatusRaw) ? currentStatusRaw : [currentStatusRaw];

  const COLIS_PIPELINE_SET = new Set(['att_ramassage','expedier','recu_livreur','livre','change','refuse','pas_rep_lv','pret_retour','dem_suivi','injoignable','manque_stock','en_suivi','retour_recu','echange_recu']);

  const isCasa = (city) => {
    if (!city) return false;
    const c = city.toLowerCase().replace(/[\s\-]/g, '');
    return ['casa','casablanca','كازا','كازابلانكا','الدارالبيضاء','الدار البيضاء','dar el beida','darelbeida'].some(k => c.includes(k.replace(/[\s\-]/g, '')));
  };

  const filtered = useMemo(() => {
    const af = appliedFilter;
    return orders.filter((o) => {
      /* Orders in the colis pipeline must NOT appear in order tabs */
      const inColisPipeline = COLIS_PIPELINE_SET.has(o.status) || !!(o.trackingNumber && o.validated);
      if (inColisPipeline) return false;
      if (!currentStatuses.includes(o.status)) return false;
      /* Search */
      const q = search.toLowerCase();
      if (q && !o.id.toLowerCase().includes(q) && !o.recipient.name.toLowerCase().includes(q) && !o.recipient.phone.includes(q) && !o.product.name.toLowerCase().includes(q)) return false;
      /* Advanced filters */
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
  }, [orders, currentStatuses, search, appliedFilter, modifiedIds]);

  const paged = useMemo(() => paginate(filtered, pgPage, pgPer), [filtered, pgPage, pgPer]);
  const safePage = Math.min(pgPage, Math.max(1, Math.ceil(filtered.length / pgPer)));
  if (safePage !== pgPage && filtered.length > 0) setPgPage(safePage);

  function toggleSelect(id) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleAll() {
    if (selected.length === filtered.length) {
      setSelected([]);
    } else {
      setSelected(filtered.map((o) => o.id));
    }
  }

  function addToast(type, title, body) {
    const id = Date.now();
    setToasts((p) => [...p, { id, type, title, body }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 6000);
  }

  function openOzone(order) {
    setOzoneOrder(order);
    setOzoneOpen(true);
  }

  function handleOzoneSuccess(orderId, ozoneTracking) {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, validated: true, trackingNumber: o.trackingNumber || ozoneTracking, ozoneTracking: ozoneTracking, status: 'att_ramassage' } : o
      )
    );
    addToast('success', `Colis créé — ${ozoneTracking}`, 'Commande déplacée vers En suivi');
    setOzoneOpen(false);
  }

  function openEdit(order) {
    setEditOrder(order);
    setModalOpen(true);
  }

  function saveOrder(updated) {
    const prev = orders.find(o => o.id === updated.id);
    if (prev && prev.status !== updated.status) {
      recordHistory(updated.id, updated.status, currentUser);
    }
    if (!updated.trackingNumber) {
      updated.trackingNumber = generateTrackingNumber();
    }
    setModifiedIds(prev => new Set([...prev, updated.id]));
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    setModalOpen(false);
  }

  function exportOrdersCSV(data) {
    const header = ['ID','Nom','Téléphone','Ville','Adresse','Livreur','Produit','Prix','Statut','Date ajout'];
    const csvRows = [header.join(',')];
    data.forEach(o => {
      const st = statuses.find(s => s.value === o.status);
      csvRows.push([
        o.id, o.recipient?.name || '', o.recipient?.phone || '',
        o.recipient?.city || '', `"${(o.recipient?.address || '').replace(/"/g, '""')}"`,
        o.recipient?.delivery || '', (o.products?.[0]?.name || o.product?.name || ''),
        o.price || 0, st?.label || o.status, o.dateAdded || ''
      ].join(','));
    });
    const blob = new Blob(['﻿' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `commandes_${activeTab}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  const activeTabLabel = tabs.find((t) => t.id === activeTab)?.label || '';

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-400 font-medium">Chargement des commandes…</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <span className="font-bold text-gray-700 text-base mr-2">{activeTabLabel}</span>
        <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full mr-2">{filtered.length}</span>
        <div className="relative flex items-center flex-1 max-w-xs">
          <input
            type="text"
            placeholder="Rechercher une commande..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-3 pr-10 py-1.5 border border-gray-300 rounded-l-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <button className="px-3 py-[7px] bg-blue-600 text-white rounded-r-md hover:bg-blue-700 transition">
            <Search size={16} />
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setFilterOpen(o => !o)}
            className={`p-2 rounded-md border text-sm font-medium transition-colors ${
              isFilterActive
                ? 'border-indigo-400 bg-indigo-50 text-indigo-600'
                : filterOpen
                ? 'border-gray-400 bg-gray-100 text-gray-700'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
            title="Filtre avancé"
          >
            <Filter size={14} />
          </button>
          <button onClick={() => window.print()} className="p-2 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50" title="Imprimer">
            <Printer size={14} />
          </button>
          <button onClick={() => exportOrdersCSV(filtered)} className="p-2 rounded-md bg-green-500 text-white hover:bg-green-600" title="Exporter CSV">
            <Upload size={14} />
          </button>
          <button className="p-2 rounded-md bg-gray-500 text-white hover:bg-gray-600" title="Paramètres">
            <Settings size={14} />
          </button>
          <button
            onClick={() => setNewOrderOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold"
            title="Nouvelle commande"
          >
            <Plus size={14} /> Nouveau
          </button>
        </div>
      </div>

      {/* Advanced Filter Panel */}
      {filterOpen && (() => {
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
                    {statuses.filter(s => s.showInCommandes !== false).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
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
                  <input type="date" value={filterForm.dateFrom} onChange={e => setFilterForm(p => ({ ...p, dateFrom: e.target.value }))} className="w-full bg-white border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-blue-400" />
                </div>
                {/* Date de mise à jour */}
                <div>
                  <label className="block text-xs text-gray-500 font-semibold mb-1">Date de mise à jour</label>
                  <input type="date" value={filterForm.dateTo} onChange={e => setFilterForm(p => ({ ...p, dateTo: e.target.value }))} className="w-full bg-white border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-blue-400" />
                </div>
                {/* Buttons */}
                <div className="col-span-2 flex items-end justify-end gap-2">
                  <button onClick={resetFilter} className="px-4 py-1.5 rounded bg-teal-500 hover:bg-teal-600 text-sm text-white font-semibold transition-colors">Réinitialiser</button>
                  <button onClick={applyFilter} className="px-4 py-1.5 rounded bg-gray-700 hover:bg-gray-800 text-sm text-white font-semibold transition-colors">Appliquer les filtres</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse min-w-[900px]">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 w-8">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selected.length === filtered.length}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded"
                />
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Destinataire</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Produits</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Prix</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">État</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 max-w-xs">Note</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Date</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Validé</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-12 text-gray-400">
                  Aucune commande trouvée
                </td>
              </tr>
            )}
            {paged.map((order, idx) => (
              <tr
                key={order.id}
                className={`border-b border-gray-100 transition-colors ${
                  selected.includes(order.id)
                    ? 'bg-indigo-50 border-l-[3px] border-indigo-500'
                    : isCasa(order.recipient?.city)
                      ? 'bg-sky-50/70 border-l-[3px] border-sky-400 hover:bg-sky-100/60'
                      : `${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'} hover:bg-blue-50/30 border-l-[3px] border-transparent`
                }`}
              >
                {/* Checkbox */}
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(order.id)}
                    onChange={() => toggleSelect(order.id)}
                    className="w-4 h-4 rounded"
                  />
                </td>

                {/* Destinataire */}
                <td className="px-4 py-4 min-w-[220px]">
                  <div className="text-sm font-bold text-orange-600 font-mono mb-1">{order.trackingNumber || order.id}</div>
                  <div className="text-base font-bold text-gray-900 max-w-[220px] truncate">{order.recipient.name}</div>
                  <div className="text-sm text-gray-500 mt-0.5">{order.recipient.address}</div>
                  <div className="text-sm font-bold text-gray-800">{order.recipient.city}</div>
                  <PhoneChip phone={order.recipient.phone} />
                  {order.recipient.delivery && (
                    <div className="mt-1.5 flex items-center gap-1 text-xs font-medium text-gray-500">
                      <Truck size={11} />
                      <span>{order.recipient.delivery}</span>
                    </div>
                  )}
                </td>

                {/* Produits */}
                <td className="px-4 py-4 min-w-[180px]">
                  {(order.products?.length > 0 ? order.products : [order.product]).map((p, i) => p && (
                    <div key={i} className="text-sm leading-relaxed mb-0.5">
                      <span className="font-semibold text-gray-800">{p.name}</span>
                      {p.color && <span className="ml-1 text-sm font-semibold text-blue-600">{p.color}</span>}
                      {p.size && <span className="ml-1 text-sm text-gray-600">- {p.size}</span>}
                      <div className="text-sm text-gray-500">({p.qty || 1}x)</div>
                    </div>
                  ))}
                </td>

                {/* Prix */}
                <td className="px-4 py-4 min-w-[100px]">
                  <div className="font-extrabold text-gray-900 text-xl">
                    {Number(order.price || 0).toLocaleString('fr-MA', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-sm font-semibold text-gray-500">DH</div>
                </td>

                {/* État — click to change */}
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-1.5">
                    <button
                      onClick={() => setStatusDropdown({ order })}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      <StatusBadge status={order.status} reportDate={order.reportDate} />
                    </button>
                    {order.whatsapp && (
                      <span className="flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                        <MessageCircle size={10} /> WA
                      </span>
                    )}
                  </div>
                </td>

                {/* Note */}
                <td className="px-4 py-3 max-w-[220px]">
                  {order.note ? (
                    <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">
                      {order.note}
                    </p>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>

                {/* Date */}
                <td className="px-4 py-3 min-w-[140px]">
                  <div className="text-xs text-gray-500">
                    <span className="font-medium text-gray-600">Date ajout:</span>
                    <br />
                    {order.dateAdded}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    <span className="font-medium text-gray-600">Date mise à jour:</span>
                    <br />
                    {order.dateUpdated}
                  </div>
                </td>

                {/* Validé → Envoyer à Ozon */}
                <td className="px-4 py-3">
                  <Toggle
                    checked={!!order.validated}
                    loading={false}
                    onChange={() => { if (!order.validated) openOzone(order); }}
                  />
                  {order.trackingNumber && (
                    <span className="text-xs text-blue-600 font-mono block mt-1 max-w-[70px] truncate" title={order.trackingNumber}>
                      {order.trackingNumber}
                    </span>
                  )}
                </td>

                {/* Action */}
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={() => openEdit(order)}
                      className="p-1.5 rounded bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                      title="Modifier"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setHistoryOrder(order)}
                      className="p-1.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                      title="Historique"
                    >
                      <History size={13} />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Supprimer la commande ${order.id} ?`)) {
                          setOrders(prev => prev.filter(o => o.id !== order.id));
                          onDeleteOrder?.(order.id);
                        }
                      }}
                      className="p-1.5 rounded bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination total={filtered.length} page={pgPage} perPage={pgPer} onPageChange={setPgPage} onPerPageChange={setPgPer} />

      {/* Footer count */}
      <div className="bg-white border-t border-gray-200 px-6 py-2 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <span>
            {filtered.length} commande{filtered.length !== 1 ? 's' : ''} affichée{filtered.length !== 1 ? 's' : ''}
            {selected.length > 0 && ` · ${selected.length} sélectionnée${selected.length > 1 ? 's' : ''}`}
          </span>
          {selected.length > 0 && (
            <button
              onClick={async () => {
                if (!window.confirm(`Supprimer définitivement ${selected.length} commande${selected.length > 1 ? 's' : ''} ?`)) return;
                for (const id of selected) {
                  setOrders(prev => prev.filter(o => o.id !== id));
                  onDeleteOrder?.(id);
                }
                setSelected([]);
              }}
              className="flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded font-semibold transition-colors"
            >
              <Trash2 size={11} /> Supprimer la sélection ({selected.length})
            </button>
          )}
        </div>
        <span className="text-gray-400">Total tous onglets : {orders.length}</span>
      </div>

      {/* Edit Modal */}
      {modalOpen && editOrder && (
        <OrderModal
          order={editOrder}
          onClose={() => setModalOpen(false)}
          onSave={saveOrder}
        />
      )}

      {ozoneOpen && ozoneOrder && (
        <OzoneModal
          order={ozoneOrder}
          onClose={() => setOzoneOpen(false)}
          onSuccess={handleOzoneSuccess}
        />
      )}

      {/* Status change modal */}
      {statusDropdown && (
        <StatusChangeModal
          order={statusDropdown.order}
          onClose={() => setStatusDropdown(null)}
          onSave={(orderId, newStatus, note) => {
            const ts = now();
            recordHistory(orderId, newStatus, currentUser);
            setModifiedIds(prev => new Set([...prev, orderId]));
            setOrders((prev) => prev.map((o) => {
              if (o.id !== orderId) return o;
              const prevNote = o.note || '';
              const addedNote = note ? `\nNote interne: ${note}` : '';
              return { ...o, status: newStatus, dateUpdated: ts, note: prevNote + addedNote };
            }));
            setStatusDropdown(null);
          }}
        />
      )}

      {/* History Modal */}
      {historyOrder && (
        <HistoryModal order={historyOrder} onClose={() => setHistoryOrder(null)} />
      )}

      {/* New Order Modal */}
      {newOrderOpen && (
        <NewOrderModal
          onClose={() => setNewOrderOpen(false)}
          onSave={(ordersList) => {
            setOrders((prev) => [...ordersList, ...prev]);
            setNewOrderOpen(false);
            addToast('success', `${ordersList.length} commande(s) créée(s)`, ordersList[0]?.recipient.name);
          }}
        />
      )}

      <Toast toasts={toasts} onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </div>
  );
}

/* ─── Mini new-order form ─── */
function NewOrderModal({ onClose, onSave }) {
  const ic = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300';
  const icSm = 'border border-gray-200 rounded-md px-1.5 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white';
  const lc = 'block text-xs font-semibold text-gray-600 mb-1';
  const [stockProducts, setStockProducts] = useState(loadProducts());
  useEffect(() => {
    loadProductsRemote().then(remote => {
      if (remote && remote.length > 0) {
        localStorage.setItem('victoury_products', JSON.stringify(remote));
        setStockProducts(remote);
      }
    });
  }, []);
  const { statuses } = useStatuses();
  const livreurOptions = (() => {
    try {
      const stored = JSON.parse(localStorage.getItem('livreurs') || '[]');
      if (Array.isArray(stored) && stored.length > 0)
        return [{ value: '', label: 'Sélectionner un livreur' }, ...stored.filter(l => l.statut !== false).map(l => ({ value: l.nom, label: l.nom }))];
    } catch {}
    return [{ value: '', label: 'Sélectionner un livreur' }];
  })();
  const [form, setForm] = useState({
    nom: '', telephone: '', ville: '', adresse: '', prix: '', livreur: '',
    products: [{ name: '', size: '', qty: 1 }],
    status: 'nouveau',
    qty: 1,
  });
  function u(k, v) { setForm((p) => ({ ...p, [k]: v })); }
  function updateProduct(idx, field, value) {
    setForm(p => {
      const products = [...p.products];
      products[idx] = { ...products[idx], [field]: value, ...(field === 'name' ? { size: '' } : {}) };
      return { ...p, products };
    });
  }
  function addProduct() { setForm(p => ({ ...p, products: [...p.products, { name: '', size: '', qty: 1 }] })); }
  function removeProduct(idx) { setForm(p => ({ ...p, products: p.products.filter((_, i) => i !== idx) })); }

  async function handleSave() {
    if (!form.nom || !form.telephone || !form.prix) return;
    const count = Math.max(1, Math.min(form.qty || 1, 500));
    const t = now();
    const firstProd = form.products[0] || {};
    const createdOrders = [];
    for (let i = 0; i < count; i++) {
      const id = await generateVictId();
      createdOrders.push({
        id,
        recipient: { name: form.nom, phone: form.telephone, city: form.ville, address: form.adresse, delivery: form.livreur || null },
        product: { name: firstProd.name, size: firstProd.size, qty: firstProd.qty || 1, stock: 0 },
        products: form.products,
        price: parseFloat(form.prix) || 0,
        status: form.status || 'nouveau',
        note: '',
        dateAdded: t,
        dateUpdated: t,
        validated: false,
      });
    }
    onSave(createdOrders);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-gray-800">Nouvelle commande</h3>
            <p className="text-xs text-indigo-600 font-mono mt-0.5">ID : auto-généré</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><XCircle size={16} className="text-gray-400" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lc}>Nom client <span className="text-red-500">*</span></label><input value={form.nom} onChange={(e) => u('nom', e.target.value)} className={ic} /></div>
            <div><label className={lc}>Téléphone <span className="text-red-500">*</span></label><input value={form.telephone} onChange={(e) => u('telephone', e.target.value)} className={ic} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lc}>Ville</label><input value={form.ville} onChange={(e) => u('ville', e.target.value)} className={ic} /></div>
            <div><label className={lc}>Adresse</label><input value={form.adresse} onChange={(e) => u('adresse', e.target.value)} className={ic} /></div>
          </div>
          <div>
            <label className={lc}>Livreur</label>
            <select value={form.livreur} onChange={(e) => u('livreur', e.target.value)} className={ic}>
              {livreurOptions.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>

          <div>
            <label className={lc}>Produits</label>
            <div className="space-y-1.5">
              {form.products.map((prod, idx) => {
                const selProd = stockProducts.find(p => p.name === prod.name);
                const sizes = selProd ? selProd.variations.map(v => v.taille) : [];
                return (
                  <div key={idx} className="flex flex-col gap-1 border border-gray-100 rounded-lg p-1.5 bg-gray-50">
                    <div className="flex items-center gap-1.5">
                      <select
                        value={prod.name}
                        onChange={(e) => updateProduct(idx, 'name', e.target.value)}
                        className={`${ic} flex-1 min-w-0 py-1.5 text-xs`}
                      >
                        <option value="">-- Produit --</option>
                        {stockProducts.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                      </select>
                      <button onClick={() => removeProduct(idx)}
                        className="p-1.5 rounded-md bg-red-500 text-white hover:bg-red-600 shrink-0">
                        <X size={12} />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        value={prod.color || ''}
                        onChange={(e) => updateProduct(idx, 'color', e.target.value)}
                        placeholder="Couleur"
                        className={`${icSm} flex-1 min-w-0`}
                      />
                      <select
                        value={prod.size || ''}
                        onChange={(e) => updateProduct(idx, 'size', e.target.value)}
                        className={`${icSm} w-16 shrink-0`}
                      >
                        <option value="">T.</option>
                        {sizes.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <input
                        type="number" min={1} value={prod.qty}
                        onChange={(e) => updateProduct(idx, 'qty', Number(e.target.value))}
                        className={`${icSm} w-12 text-center shrink-0`}
                      />
                    </div>
                  </div>
                );
              })}
              <button onClick={addProduct}
                className="w-full border-2 border-dashed border-gray-300 rounded-md py-1.5 text-xs text-gray-500 hover:border-indigo-400 hover:text-indigo-500 flex items-center justify-center gap-1">
                <Plus size={12} /> Ajouter un produit
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className={lc}>Prix total (DH) <span className="text-red-500">*</span></label>
            <input type="number" value={form.prix} onChange={(e) => u('prix', e.target.value)} className={ic} /></div>
            <div><label className={lc}>Nombre de commandes</label>
            <input type="number" min={1} max={500} value={form.qty} onChange={(e) => u('qty', Math.max(1, Number(e.target.value)))} className={ic} /></div>
          </div>
          <div>
            <label className={lc}>Statut</label>
            <select value={form.status} onChange={(e) => u('status', e.target.value)} className={ic}>
              {statuses.filter(s => s.showInCommandes !== false).map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700">Annuler</button>
          <button onClick={handleSave} disabled={!form.nom || !form.telephone || !form.prix}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
            {form.qty > 1 ? `Créer ${form.qty} commandes` : 'Créer la commande'}
          </button>
        </div>
      </div>
    </div>
  );
}
