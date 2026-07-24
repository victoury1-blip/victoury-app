import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import useDebounce from '../hooks/useDebounce';
import useSearchShortcut from '../hooks/useSearchShortcut';
import Pagination, { paginate } from './Pagination';
import {
  Search,
  Filter,
  Printer,
  Upload,
  Download,
  Settings,
  Pencil,
  MessageCircle,
  Phone,
  MapPin,
  Truck,
  CheckCircle2,
  XCircle,
  Copy,
  Plus,
  Check,
  ChevronDown,
  X,
  Trash2,
  History,
  AlertTriangle,
  BookmarkPlus,
  Bookmark,
} from 'lucide-react';
import OrderModal from './OrderModal';
import Toggle from './Toggle';
import PhoneChip from './PhoneChip';
import OzoneModal from './OzoneModal';
import StatusDropdown from './StatusDropdown';
import { useStatuses } from '../contexts/StatusContext';
import { supabase } from '../lib/supabase';
import { useToast } from './Toast';
import { cloudGet, cloudSet } from '../lib/cloudSettings';
import { loadProducts, loadProductsRemote, saveProducts } from '../data/products';
import { fetchChicProductDetails, fetchChicProducts, createChicOrder, getChicConfig } from '../lib/chicAffiliate';
import { exportToExcel, exportToPDF } from '../lib/exportUtils';
import { buildWhatsappMessage } from '../lib/whatsappTemplates';
import { now } from '../lib/dateUtils';
import { initVictCounter, recalcVictCounter, generateVictId } from '../lib/victId';
import { recordHistory } from '../lib/orderHistory';
import StatusBadge from './orders/StatusBadge';
import HistoryModal from './orders/HistoryModal';
import CustomerHistoryModal from './orders/CustomerHistoryModal';
import StatusChangeModal from './orders/StatusChangeModal';
import NewOrderModal from './orders/NewOrderModal';



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



/* ─── Bulk Action Bar ─── */
function BulkActionBar({ selected, orders, setOrders, setSelected, onDeleteOrder, currentUser, filtered }) {
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

  function bulkChangeStatus(newStatus) {
    const ts = now();
    selected.forEach(id => recordHistory(id, newStatus, currentUser));
    // Les VICTxxxx sont générés AVANT setOrders : l'updater doit rester pur
    // (StrictMode le ré-exécute et brûlerait/dupliquerait des ids).
    const newIds = new Map();
    if (newStatus === 'confirme') {
      for (const o of orders) {
        if (selected.includes(o.id) && !/^VICT\d+$/i.test(o.trackingNumber || '')) newIds.set(o.id, generateVictId());
      }
    }
    setOrders(prev => prev.map(o => {
      if (!selected.includes(o.id)) return o;
      return { ...o, status: newStatus, trackingNumber: newIds.get(o.id) || o.trackingNumber, dateUpdated: ts };
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

  function bulkDelete() {
    if (!window.confirm(`Supprimer définitivement ${selected.length} commande${selected.length > 1 ? 's' : ''} ?`)) return;
    const remaining = orders.filter(o => !selected.includes(o.id));
    for (const id of selected) {
      setOrders(prev => prev.filter(o => o.id !== id));
      onDeleteOrder?.(id);
    }
    recalcVictCounter(remaining);
    setSelected([]);
  }

  function bulkExport() {
    const data = selectedOrders;
    const header = ['ID','Nom','Téléphone','Ville','Adresse','Livreur','Produit','Taille','Qty','Prix','Statut','Date ajout'];
    const csvRows = [header.join(',')];
    // Chaque champ est quoté : une virgule dans un nom/produit décalerait les colonnes.
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    data.forEach(o => {
      const st = statuses.find(s => s.value === o.status);
      csvRows.push([
        q(o.id), q(o.recipient?.name || ''), q(o.recipient?.phone || ''),
        q(o.recipient?.city || ''), q(o.recipient?.address || ''),
        q(o.recipient?.delivery || ''), q(o.products?.[0]?.name || o.product?.name || ''),
        q(o.products?.[0]?.size || o.product?.size || ''),
        (o.products?.[0]?.qty || o.product?.qty || 1),
        o.price || 0, q(st?.label || o.status), q(o.dateAdded || '')
      ].join(','));
    });
    const blob = new Blob(['﻿' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `selection_${selected.length}_commandes_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  function bulkPrintBordereau() {
    const _e = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const data = selectedOrders;
    const rows = data.map(o => `
      <tr>
        <td style="font-weight:bold;color:#1e3a8a">${_e(o.id)}</td>
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
    <div class="meta">
      Date: <strong>${new Date().toLocaleDateString('fr-MA')}</strong> &nbsp;|&nbsp;
      Nombre de colis: <strong>${data.length}</strong>
    </div>
    <table>
      <thead><tr><th>ID</th><th>Client</th><th>Tél</th><th>Ville</th><th>Adresse</th><th>Produit</th><th>Prix</th><th>Livreur</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="total">Total: ${totalPrice.toFixed(2)} DH</div>
    <script>window.onload=()=>window.print();</script>
    </body></html>`;

    const w = window.open('', '_blank');
    if (!w) return; // popup bloquée par le navigateur
    w.document.write(html);
    w.document.close();
  }

  return (
    <div className="bg-gray-900 border-t border-gray-700 px-6 py-3 flex items-center gap-3 animate-slideUp">
      <div className="flex items-center gap-2 mr-3">
        <span className="bg-blue-600 text-white text-xs font-black px-2.5 py-1 rounded-full">{selected.length}</span>
        <span className="text-sm font-semibold text-white">sélectionnée{selected.length > 1 ? 's' : ''}</span>
      </div>

      <div className="h-6 w-px bg-gray-600 mx-1" />

      {/* Change Status */}
      <div className="relative" ref={statusRef}>
        <button onClick={() => { setShowStatus(o => !o); setShowLivreur(false); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors">
          <CheckCircle2 size={13} /> Changer statut <ChevronDown size={11} />
        </button>
        {showStatus && (
          <div className="absolute bottom-full mb-2 left-0 bg-white border border-gray-200 rounded-xl shadow-2xl w-56 max-h-64 overflow-y-auto z-50">
            {statuses.filter(s => s.showInCommandes !== false).map(s => (
              <button key={s.value} onClick={() => bulkChangeStatus(s.value)}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 text-gray-700 border-b border-gray-50 last:border-0 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color || '#6B7280' }} />
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

      {/* Export CSV */}
      <button onClick={bulkExport}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-xs font-semibold transition-colors">
        <Download size={13} /> Exporter
      </button>

      <div className="ml-auto flex items-center gap-2">
        {/* Delete */}
        <button onClick={bulkDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors">
          <Trash2 size={13} /> Supprimer
        </button>

        {/* Deselect */}
        <button onClick={() => setSelected([])}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-500 text-gray-300 hover:bg-gray-700 rounded-lg text-xs font-semibold transition-colors">
          <X size={13} /> Annuler
        </button>
      </div>
    </div>
  );
}

export default function OrdersPage({ activeTab, setActiveTab, externalOrders, setExternalOrders, isLoading, onDeleteOrder, currentUser }) {
  const { statuses } = useStatuses();
  const orders = externalOrders;
  useEffect(() => { if (orders.length) initVictCounter(orders); }, [orders]);
  function setOrders(updater) {
    setExternalOrders(updater);
  }
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const searchRef = useRef(null);
  useSearchShortcut(searchRef);

  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const idx = tabs.findIndex(t => t.id === activeTab);
      if (e.key === 'ArrowRight') setActiveTab(tabs[(idx + 1) % tabs.length].id);
      if (e.key === 'ArrowLeft')  setActiveTab(tabs[(idx - 1 + tabs.length) % tabs.length].id);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTab, setActiveTab]);
  const [pgPage, setPgPage] = useState(1);
  const [pgPer, setPgPer] = useState(10);
  const [selected, setSelected] = useState([]);
  const [editOrder, setEditOrder] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [ozoneOrder, setOzoneOrder] = useState(null);
  const [ozoneOpen, setOzoneOpen] = useState(false);
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [statusDropdown, setStatusDropdown] = useState(null); /* { order, anchor } */
  const [whatsappPopup, setWhatsappPopup] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [modifiedIds, setModifiedIds] = useState(new Set());
  const [historyOrder, setHistoryOrder] = useState(null);
  const [customerHistory, setCustomerHistory] = useState(null);
  const [chicSending, setChicSending] = useState(null);

  const [chicProducts, setChicProducts] = useState(() => {
    return loadProducts().filter(p => p.source === 'chic-affiliate');
  });
  useEffect(() => {
    const local = loadProducts().filter(p => p.source === 'chic-affiliate');
    if (local.length > 0) setChicProducts(local);
    loadProductsRemote().then(remote => {
      const chic = (remote || []).filter(p => p.source === 'chic-affiliate');
      if (chic.length > chicProducts.length) setChicProducts(chic);
    }).catch(() => {});
  }, []);

  function isChicOrder(order) {
    const prods = order.products?.length ? order.products : [order.product];
    return prods.some(p => p?.name && chicProducts.find(cp =>
      cp.name?.toLowerCase().trim() === p.name.toLowerCase().trim()
    ));
  }

  function getChicProductForOrder(order) {
    const prods = order.products?.length ? order.products : [order.product];
    for (const p of prods) {
      if (!p?.name) continue;
      const cp = chicProducts.find(cp =>
        cp.name?.toLowerCase().trim() === p.name.toLowerCase().trim()
      );
      if (cp) return { chicProd: cp, orderProd: p };
    }
    return null;
  }

  async function forwardToChic(order) {
    const config = getChicConfig();
    if (!config) { toast.error('Chic Affiliate non configuré — allez dans la page Chic Affiliate'); return; }
    const match = getChicProductForOrder(order);
    if (!match) { toast.error('Produit Chic non trouvé'); return; }
    setChicSending(order.id);
    try {
      let chicId = match.chicProd.chicId;
      if (!chicId) {
        const chicList = await fetchChicProducts();
        const normalize = s => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
        const prodName = normalize(match.chicProd.name);
        const found = (chicList.data || []).find(cp => normalize(cp.name) === prodName)
          || (chicList.data || []).find(cp => normalize(cp.name).includes(prodName) || prodName.includes(normalize(cp.name)));
        if (!found?.chicId) { toast.error(`Produit "${match.chicProd.name}" non trouvé sur chic-affiliate.com`); setChicSending(null); return; }
        chicId = found.chicId;
        const prods = loadProducts().map(p =>
          p.id === match.chicProd.id ? { ...p, chicId } : p
        );
        saveProducts(prods);
      }
      const details = await fetchChicProductDetails(chicId);
      const villeMatch = details.cities.find(c =>
        c.name.toLowerCase().includes((order.recipient?.city || '').toLowerCase())
      );

      await createChicOrder({
        token: details.token,
        productId: details.productId,
        size: match.orderProd.size || (details.sizes[0] || ''),
        color: details.colors[0]?.id || '',
        quantity: match.orderProd.qty || 1,
        recipientPrice: order.price || 0,
        recipient: order.recipient?.name || '',
        phone: order.recipient?.phone || '',
        villeId: villeMatch?.id || (details.cities[0]?.id || ''),
        fraisLivraison: '',
        address: order.recipient?.address || '',
        comment: `Commande ${order.id}`,
      });

      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, chicForwarded: true } : o));
      toast.success(`Commande ${order.id} envoyée à Chic Affiliate !`);
    } catch (e) {
      toast.error('Erreur: ' + e.message);
    } finally {
      setChicSending(null);
    }
  }

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

  /* ── Saved filters ── */
  const [savedFilters, setSavedFilters] = useState(() => {
    try { return JSON.parse(localStorage.getItem('victoury_saved_filters') || '[]'); } catch { return []; }
  });
  const [saveFilterName, setSaveFilterName] = useState('');
  const [savedFilterDropdown, setSavedFilterDropdown] = useState(false);
  const savedFilterRef = useRef(null);
  useEffect(() => {
    cloudGet('victoury_saved_filters').then(remote => {
      if (Array.isArray(remote) && remote.length > 0) setSavedFilters(remote);
    }).catch(() => {});
  }, []);
  function persistSavedFilters(list) { localStorage.setItem('victoury_saved_filters', JSON.stringify(list)); cloudSet('victoury_saved_filters', list); setSavedFilters(list); }
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

  const currentStatusRaw = tabs.find((t) => t.id === activeTab)?.status || 'nouveau';
  const currentStatuses = Array.isArray(currentStatusRaw) ? currentStatusRaw : [currentStatusRaw];

  const COLIS_PIPELINE_SET = new Set(['att_ramassage','expedier','recu_livreur','livre','change','refuse','annule','pas_rep_lv','pret_retour','dem_suivi','en_suivi','retour_recu','echange_recu']);

  const isCasa = (city) => {
    if (!city) return false;
    const c = city.toLowerCase().replace(/[\s\-]/g, '');
    return ['casa','casablanca','كازا','كازابلانكا','الدارالبيضاء','الدار البيضاء','dar el beida','darelbeida'].some(k => c.includes(k.replace(/[\s\-]/g, '')));
  };

  const duplicateGroups = useMemo(() => {
    const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const byPhone = {};
    orders.forEach(o => {
      // Ne détecter les doublons que parmi les commandes à confirmer (nouvelles) :
      // celles déjà dans la Liste des Colis (validées / avec suivi) sont exclues.
      const inColisPipeline = COLIS_PIPELINE_SET.has(o.status) || !!(o.trackingNumber && o.validated);
      if (inColisPipeline) return;
      const phone = o.recipient?.phone?.replace(/\s/g, '');
      const day = o.dateAdded?.split(' ')[0] || '';
      if (!phone || day !== today) return;
      if (!byPhone[phone]) byPhone[phone] = [];
      byPhone[phone].push(o);
    });
    return Object.entries(byPhone).filter(([, arr]) => arr.length > 1).map(([phone, arr]) => ({ phone, orders: arr }));
  }, [orders]);

  const filtered = useMemo(() => {
    const af = appliedFilter;
    return orders.filter((o) => {
      /* Orders in the colis pipeline must NOT appear in order tabs */
      const inColisPipeline = COLIS_PIPELINE_SET.has(o.status) || !!(o.trackingNumber && o.validated);
      if (inColisPipeline) return false;
      if (!currentStatuses.includes(o.status)) return false;
      /* Search */
      const q = debouncedSearch.toLowerCase();
      if (q && !o.id.toLowerCase().includes(q)
            && !(o.recipient?.name || '').toLowerCase().includes(q)
            && !(o.recipient?.phone || '').includes(q)
            && !(o.products?.[0]?.name || o.product?.name || '').toLowerCase().includes(q)) return false;
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
          if (af.dateFrom && d < new Date(af.dateFrom + 'T00:00:00')) return false;
          if (af.dateTo && d > new Date(af.dateTo + 'T23:59:59')) return false;
        }
      }
      return true;
    });
  }, [orders, currentStatuses, debouncedSearch, appliedFilter, modifiedIds]);

  /* ── Relance : reportées dont la date de rappel est atteinte ── */
  const isDueForRelance = (o) => {
    if (o.status !== 'reporter' || !o.reportDate) return false;
    const d = new Date(o.reportDate + (o.reportDate.length <= 10 ? 'T23:59:59' : ''));
    return !isNaN(d.getTime()) && d <= new Date();
  };
  const dueRelance = useMemo(
    () => (activeTab === 'reporter' ? filtered.filter(isDueForRelance) : []),
    [filtered, activeTab]
  );
  /* Dans l'onglet Reporté, les commandes à relancer passent en tête (plus ancienne d'abord). */
  const displayList = useMemo(() => {
    if (activeTab !== 'reporter' || !dueRelance.length) return filtered;
    const due = new Set(dueRelance.map(o => o.id));
    return [...filtered].sort((a, b) => {
      const da = due.has(a.id), db = due.has(b.id);
      if (da !== db) return da ? -1 : 1;
      if (da && db) return String(a.reportDate || '').localeCompare(String(b.reportDate || ''));
      return 0;
    });
  }, [filtered, dueRelance, activeTab]);

  const maxPage = Math.max(1, Math.ceil(filtered.length / pgPer));
  useEffect(() => {
    if (pgPage > maxPage && filtered.length > 0) setPgPage(maxPage);
  }, [pgPage, maxPage, filtered.length]);
  const paged = useMemo(() => paginate(displayList, Math.min(pgPage, maxPage), pgPer), [displayList, pgPage, maxPage, pgPer]);

  function toggleSelect(id) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleAll() {
    const pageIds = paged.map((o) => o.id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
    if (allSelected) {
      setSelected((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelected((prev) => [...new Set([...prev, ...pageIds])]);
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
        o.id === orderId ? { ...o, validated: true, trackingNumber: ozoneTracking || o.trackingNumber, ozoneTracking: ozoneTracking, status: 'att_ramassage', dateUpdated: now() } : o
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
      recordHistory(updated.id, updated.status, currentUser, prev.status);
    }
    if (prev && prev.recipient?.delivery?.nom !== updated.recipient?.delivery?.nom) {
      const livreurNote = `Livreur: ${prev.recipient?.delivery?.nom || '—'} → ${updated.recipient?.delivery?.nom || '—'}`;
      recordHistory(updated.id, updated.status, currentUser, null, livreurNote);
    }
    // Ne pas figer l'ID de commande comme numéro de suivi : l'affichage utilise
    // déjà `trackingNumber || id` en repli. Sinon ce placeholder (WC-xxxx)
    // masque le vrai numéro de suivi Ozon lors de la création du colis.
    setModifiedIds(prev => new Set([...prev, updated.id]));
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    setModalOpen(false);
  }

  function exportOrdersCSV(data) {
    const header = ['ID','Nom','Téléphone','Ville','Adresse','Livreur','Produit','Prix','Statut','Date ajout'];
    const csvRows = [header.join(',')];
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    data.forEach(o => {
      const st = statuses.find(s => s.value === o.status);
      csvRows.push([
        q(o.id), q(o.recipient?.name || ''), q(o.recipient?.phone || ''),
        q(o.recipient?.city || ''), q(o.recipient?.address || ''),
        q(o.recipient?.delivery || ''), q(o.products?.[0]?.name || o.product?.name || ''),
        o.price || 0, q(st?.label || o.status), q(o.dateAdded || '')
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
    <div className="flex flex-col h-full p-4 gap-3 animate-pulse">
      <div className="h-9 w-64 bg-gray-200 rounded-lg" />
      <div className="h-10 w-full bg-gray-200 rounded-xl" />
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="h-14 w-full bg-gray-200 rounded-xl" />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {activeTab === 'a_confirmer' && duplicateGroups.length > 0 && (
        <div className="mx-4 mt-2 mb-0 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <div className="flex items-center gap-2 font-bold mb-1">
            <AlertTriangle size={16} /> Commandes en double détectées aujourd'hui
          </div>
          {duplicateGroups.map(g => (
            <p key={g.phone} className="text-xs ml-6">
              📞 {g.phone} — {g.orders.length} commandes ({g.orders.map(o => o.id).join(', ')})
            </p>
          ))}
        </div>
      )}
      {activeTab === 'reporter' && dueRelance.length > 0 && (
        <div className="mx-4 mt-2 mb-0 p-3 bg-orange-50 border border-orange-300 rounded-xl text-sm text-orange-800">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle size={16} />
            📞 {dueRelance.length} commande{dueRelance.length > 1 ? 's' : ''} à relancer aujourd'hui — affichée{dueRelance.length > 1 ? 's' : ''} en tête de liste
          </div>
        </div>
      )}
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 pl-16 sm:pl-6 flex items-center flex-wrap gap-x-3 gap-y-2">
        <span className="font-bold text-gray-700 text-base mr-2">{activeTabLabel}</span>
        <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full mr-2">{filtered.length}</span>
        <div className="relative flex items-center flex-1 max-w-xs">
          <input
            type="text"
            placeholder="Rechercher une commande... (/)"
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-3 pr-10 py-1.5 border border-gray-300 rounded-l-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <button className="px-3 py-[7px] bg-blue-600 text-white rounded-r-md hover:bg-blue-700 transition">
            <Search size={16} />
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2 shrink-0 flex-nowrap">
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
          <button onClick={() => window.print()} className="p-2 rounded-lg border border-sky-100 bg-sky-50 text-sky-600 hover:bg-sky-100 transition-colors" title="Imprimer">
            <Printer size={14} />
          </button>
          <button onClick={() => exportOrdersCSV(filtered)} className="p-2 rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors" title="Exporter CSV">
            <Upload size={14} />
          </button>
          <button onClick={() => exportToExcel(filtered, `commandes_${activeTab}_${new Date().toISOString().slice(0,10)}`)} className="p-2 rounded-lg border border-teal-100 bg-teal-50 text-teal-600 hover:bg-teal-100 transition-colors" title="Exporter Excel">
            <Download size={14} />
          </button>
          <button onClick={() => exportToPDF(filtered, `commandes_${activeTab}`)} className="p-2 rounded-lg border border-rose-100 bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors" title="Exporter PDF">
            <Printer size={14} />
          </button>
          <button className="p-2 rounded-lg border border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors" title="Paramètres">
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
                {/* Plage sur la date d'ajout */}
                <div>
                  <label className="block text-xs text-gray-500 font-semibold mb-1">Date d'ajout — du</label>
                  <input type="date" value={filterForm.dateFrom} onChange={e => setFilterForm(p => ({ ...p, dateFrom: e.target.value }))} className="w-full bg-white border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 font-semibold mb-1">Date d'ajout — au</label>
                  <input type="date" value={filterForm.dateTo} onChange={e => setFilterForm(p => ({ ...p, dateTo: e.target.value }))} className="w-full bg-white border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-blue-400" />
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

      {/* Table (défilable horizontalement, comme Liste des Colis) */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        <div className="border border-gray-200 rounded-xl overflow-x-auto shadow-sm">
        <table className="w-full text-sm table-fixed border-collapse min-w-[1120px]">
          <colgroup>
            <col style={{ width: '44px' }} /><col style={{ width: '220px' }} /><col style={{ width: '220px' }} />
            <col style={{ width: '100px' }} /><col style={{ width: '150px' }} /><col style={{ width: '200px' }} />
            <col style={{ width: '150px' }} /><col style={{ width: '80px' }} /><col style={{ width: '96px' }} />
          </colgroup>
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={paged.length > 0 && paged.every((o) => selected.includes(o.id))}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded"
                />
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Destinataire</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Produits</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Prix</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">État</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Note</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Date</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Validé</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Action</th>
            </tr>
          </thead>
        </table>
        <div>
        <table className="w-full text-sm table-fixed border-separate border-spacing-y-1 min-w-[1120px] [&_tbody_td]:align-middle">
          <colgroup>
            <col style={{ width: '44px' }} /><col style={{ width: '220px' }} /><col style={{ width: '220px' }} />
            <col style={{ width: '100px' }} /><col style={{ width: '150px' }} /><col style={{ width: '200px' }} />
            <col style={{ width: '150px' }} /><col style={{ width: '80px' }} /><col style={{ width: '96px' }} />
          </colgroup>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-16 text-gray-400">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-2.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                    <span className="text-sm">Aucune commande trouvée</span>
                  </div>
                </td>
              </tr>
            )}
            {paged.map((order, idx) => (
              <tr
                key={order.id}
                className={`border rounded-xl transition-all ${
                  selected.includes(order.id)
                    ? 'bg-indigo-50 border-indigo-300 shadow-sm'
                    : isCasa(order.recipient?.city)
                      ? 'bg-sky-50/70 border-sky-300 hover:bg-sky-100/60'
                      : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'
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
                  <button onClick={() => setCustomerHistory(order.recipient.phone)} className="text-base font-bold text-gray-900 max-w-[220px] truncate hover:text-blue-600 hover:underline cursor-pointer text-left">{order.recipient.name}</button>
                  <div className="text-sm text-gray-500 mt-0.5 break-words">{order.recipient.address}</div>
                  <div className="text-sm font-bold text-gray-800">{order.recipient.city}</div>
                  <PhoneChip phone={order.recipient.phone} allOrders={externalOrders} />
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
                    <div key={i} className="text-sm leading-relaxed mb-0.5 break-words">
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
                    onChange={() => {
                      if (order.validated) return;
                      const livreur = (order.recipient?.delivery || '').trim();
                      // Bloquer le passage vers la Liste des Colis sans livreur.
                      if (!livreur) {
                        addToast('error', 'Aucun livreur', `Impossible de valider ${order.id} : assignez un livreur d'abord`);
                        return;
                      }
                      if (livreur.toLowerCase().includes('ozon')) {
                        openOzone(order);
                      } else {
                        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, validated: true, status: 'att_ramassage', dateUpdated: now() } : o));
                        addToast('success', `Commande ${order.id} validée`, 'Déplacée vers Liste des Colis');
                      }
                    }}
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
                    {isChicOrder(order) && !order.chicForwarded && (
                      <button
                        onClick={() => forwardToChic(order)}
                        disabled={chicSending === order.id}
                        className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors disabled:opacity-50 whitespace-nowrap"
                        title="Envoyer à Chic Affiliate"
                      >
                        {chicSending === order.id ? '...' : '📦 Chic'}
                      </button>
                    )}
                    {order.chicForwarded && (
                      <span className="px-2 py-1 text-xs bg-green-50 text-green-600 rounded whitespace-nowrap">✅ Chic</span>
                    )}
                    <button
                      onClick={() => openEdit(order)}
                      className="p-1.5 rounded bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                      title="Modifier" aria-label="Modifier"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setHistoryOrder(order)}
                      className="p-1.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                      title="Historique" aria-label="Historique"
                    >
                      <History size={13} />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Supprimer la commande ${order.id} ?`)) {
                          setOrders(prev => {
                            const next = prev.filter(o => o.id !== order.id);
                            recalcVictCounter(next);
                            return next;
                          });
                          onDeleteOrder?.(order.id);
                        }
                      }}
                      className="p-1.5 rounded bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                      title="Supprimer" aria-label="Supprimer"
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
        </div>

        {/* Vue carte désactivée — on garde le tableau défilable comme Liste des Colis */}
        <div className="hidden">
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400 flex flex-col items-center gap-2">
              <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-2.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
              <span className="text-sm">Aucune commande trouvée</span>
            </div>
          )}
          {paged.map((order) => (
            <div key={order.id} className="bg-white border border-gray-200 rounded-xl p-3 mb-2 mx-3 shadow-sm">
              {/* Top row: checkbox + order ID + status */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(order.id)}
                    onChange={() => toggleSelect(order.id)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="font-mono text-orange-600 font-bold text-xs bg-orange-50 px-2 py-0.5 rounded-full">{order.trackingNumber || order.id}</span>
                </div>
                <button onClick={() => setStatusDropdown({ order })} className="cursor-pointer hover:opacity-80 transition-opacity">
                  <StatusBadge status={order.status} reportDate={order.reportDate} />
                </button>
              </div>
              {/* Middle: client info */}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-bold text-gray-900 text-sm">{order.recipient?.name}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <MapPin size={10} className="text-gray-400" />{order.recipient?.city}
                  </div>
                  <PhoneChip phone={order.recipient?.phone} allOrders={externalOrders} />
                </div>
                <div className="text-right shrink-0">
                  <span className="font-extrabold text-lg text-gray-900">
                    {Number(order.price || 0).toLocaleString('fr-MA', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs font-semibold text-gray-500 ml-1">DH</span>
                  {order.product?.name && <div className="text-xs text-gray-400 mt-0.5 max-w-[120px] truncate text-right">{order.product.name}</div>}
                </div>
              </div>
              {/* Bottom: actions */}
              <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-gray-50">
                <label className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Toggle
                    checked={!!order.validated}
                    loading={false}
                    onChange={() => {
                      if (order.validated) return;
                      const livreur = (order.recipient?.delivery || '').trim();
                      // Bloquer le passage vers la Liste des Colis sans livreur.
                      if (!livreur) {
                        addToast('error', 'Aucun livreur', `Impossible de valider ${order.id} : assignez un livreur d'abord`);
                        return;
                      }
                      if (livreur.toLowerCase().includes('ozon')) { openOzone(order); }
                      else {
                        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, validated: true, status: 'att_ramassage', dateUpdated: now() } : o));
                        addToast('success', `Commande ${order.id} validée`, 'Déplacée vers Liste des Colis');
                      }
                    }}
                  />
                  Validé
                </label>
                <div className="flex items-center gap-2 ml-auto">
                  {isChicOrder(order) && !order.chicForwarded && (
                    <button
                      onClick={() => forwardToChic(order)}
                      disabled={chicSending === order.id}
                      className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 disabled:opacity-50 whitespace-nowrap"
                    >
                      {chicSending === order.id ? '...' : '📦 Chic'}
                    </button>
                  )}
                  {order.chicForwarded && (
                    <span className="px-2 py-1 text-xs bg-green-50 text-green-600 rounded">✅</span>
                  )}
                  <button
                    onClick={() => openEdit(order)}
                    className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                    title="Modifier"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => setHistoryOrder(order)}
                    className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                    title="Historique"
                  >
                    <History size={15} />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Supprimer la commande ${order.id} ?`)) {
                        setOrders(prev => {
                          const next = prev.filter(o => o.id !== order.id);
                          recalcVictCounter(next);
                          return next;
                        });
                        onDeleteOrder?.(order.id);
                      }
                    }}
                    className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Pagination total={filtered.length} page={pgPage} perPage={pgPer} onPageChange={setPgPage} onPerPageChange={setPgPer} />

      {/* Bulk Action Bar */}
      {selected.length > 0 ? (
        <BulkActionBar
          selected={selected}
          orders={orders}
          setOrders={setOrders}
          setSelected={setSelected}
          onDeleteOrder={onDeleteOrder}
          currentUser={currentUser}
          filtered={filtered}
        />
      ) : (
        <div className="bg-white border-t border-gray-200 px-6 py-2 flex items-center justify-between text-xs text-gray-500">
          <span>{filtered.length} commande{filtered.length !== 1 ? 's' : ''} affichée{filtered.length !== 1 ? 's' : ''}</span>
          <span className="text-gray-400">Total tous onglets : {orders.length}</span>
        </div>
      )}

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
          onSave={(orderId, newStatus, note, reportDate) => {
            const ts = now();
            recordHistory(orderId, newStatus, currentUser);
            setModifiedIds(prev => new Set([...prev, orderId]));
            // À la confirmation, attribuer un numéro de suivi VICT (celui envoyé
            // à Ozon) si la commande n'en a pas déjà un — généré AVANT setOrders
            // pour garder l'updater pur (StrictMode le ré-exécute).
            const target = orders.find(o => o.id === orderId);
            const needsVict = newStatus === 'confirme' && !/^VICT\d+$/i.test(target?.trackingNumber || '');
            const newVict = needsVict ? generateVictId() : null;
            setOrders((prev) => prev.map((o) => {
              if (o.id !== orderId) return o;
              const prevNote = o.note || '';
              const addedNote = note ? `\nNote interne: ${note}` : '';
              return { ...o, status: newStatus, trackingNumber: newVict || o.trackingNumber, dateUpdated: ts, note: prevNote + addedNote, reportDate: newStatus === 'reporter' ? (reportDate || o.reportDate) : null };
            }));
            setStatusDropdown(null);
            const changedOrder = orders.find(o => o.id === orderId);
            if (changedOrder) {
              const wa = buildWhatsappMessage({ ...changedOrder, status: newStatus }, newStatus);
              if (wa) setWhatsappPopup(wa);
            }
          }}
        />
      )}

      {/* History Modal */}
      {historyOrder && (
        <HistoryModal order={historyOrder} onClose={() => setHistoryOrder(null)} />
      )}

      {/* Customer History Modal */}
      {customerHistory && (
        <CustomerHistoryModal
          phone={customerHistory}
          orders={externalOrders.filter(o => o.recipient?.phone === customerHistory)}
          onClose={() => setCustomerHistory(null)}
        />
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

      {/* WhatsApp auto popup */}
      {whatsappPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" role="dialog" aria-modal="true" onKeyDown={e => { if (e.key === 'Escape') setWhatsappPopup(null); }} onClick={() => setWhatsappPopup(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-5 w-[95vw] max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">💬</span>
                <span className="font-bold text-green-800 text-sm">Envoyer WhatsApp</span>
              </div>
              <button onClick={() => setWhatsappPopup(null)} aria-label="Fermer" className="p-1 hover:bg-gray-100 rounded"><X size={15} className="text-gray-400" /></button>
            </div>
            <p className="text-xs text-gray-500 mb-2">Client: <span className="font-bold text-gray-800">{whatsappPopup.name}</span> — {whatsappPopup.orderId}</p>
            <textarea
              className="w-full border border-gray-200 rounded-lg p-3 text-sm text-right leading-relaxed resize-none focus:ring-2 focus:ring-green-200 focus:border-green-300"
              rows={7} dir="rtl"
              value={whatsappPopup.msg}
              onChange={e => setWhatsappPopup(p => ({ ...p, msg: e.target.value }))}
            />
            <div className="flex gap-2 mt-3">
              <button onClick={() => setWhatsappPopup(null)} className="flex-1 py-2.5 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200">Ignorer</button>
              <button
                className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white bg-green-500 hover:bg-green-600 flex items-center justify-center gap-2"
                onClick={() => {
                  if (/android/i.test(navigator.userAgent)) {
                    window.location.href = `intent://send/${whatsappPopup.phone}#Intent;scheme=whatsapp;package=com.whatsapp.w4b;S.text=${encodeURIComponent(whatsappPopup.msg)};end`;
                  } else {
                    window.open(`https://api.whatsapp.com/send?phone=${whatsappPopup.phone}&text=${encodeURIComponent(whatsappPopup.msg)}`, '_blank');
                  }
                  setWhatsappPopup(null);
                }}
              >📤 Envoyer</button>
            </div>
          </div>
        </div>
      )}

      <Toast toasts={toasts} onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </div>
  );
}

/* ─── Mini new-order form ─── */
