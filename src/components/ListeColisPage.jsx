import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import useDebounce from '../hooks/useDebounce';
import { supabase } from '../lib/supabase';
import Pagination, { paginate } from './Pagination';
import { Search, X, ChevronDown, Check, Trash2, Phone, Pencil, Truck, MapPin, Download, Printer, BookmarkPlus, Bookmark, Clock, ScanLine, Copy } from 'lucide-react';
import OrderModal from './OrderModal';
import { buildWhatsappMessage } from '../lib/whatsappTemplates';
import { openLabelPage } from './LabelPrint';
import { useStatuses } from '../contexts/StatusContext';
import { cloudGet, cloudSet } from '../lib/cloudSettings';
import PhoneChip, { normalizePhone } from './PhoneChip';
import { useToast } from './Toast';
import Toggle from './Toggle';
import { findOrderByCode } from '../lib/scanUtils';
import DeliveryStatusModal, { DELIVERY_STATUSES } from './colis/DeliveryStatusModal';
import ScanModal from './colis/ScanModal';
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
      <div className="bg-white rounded-t-xl sm:rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">Historique du commande</h2>
            <p className="text-xs text-gray-400 mt-0.5">{order.id}</p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="p-1.5 rounded hover:bg-gray-100"><X size={15} className="text-gray-400" /></button>
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
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-800">Modifier le statut de la commande</h3>
          <button onClick={onClose} aria-label="Fermer" className="p-1 hover:bg-gray-100 rounded"><X size={16} className="text-gray-400" /></button>
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
function ColisBulkActionBar({ selected, setSelected, orders, setOrders, colis, onDeleteOrder }) {
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

  function bulkDelete() {
    if (!selected.length) return;
    if (!window.confirm(`Supprimer définitivement ${selected.length} colis ?`)) return;
    [...selected].forEach(id => onDeleteOrder?.(id));
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

      {/* Supprimer */}
      <button onClick={bulkDelete}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold transition-colors">
        <Trash2 size={13} /> Supprimer
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
const COLIS_PIPELINE = ['ramasse','att_ramassage','expedier','recu_livreur','livre','change','refuse','annule','pas_rep_lv','pret_retour','dem_suivi','en_suivi','retour_recu','echange_recu','reporter','manque_stock'];
const isCasa = (city) => {
  if (!city) return false;
  const c = city.toLowerCase().replace(/[\s\-]/g, '');
  return ['casa','casablanca','كازا','كازابلانكا','الدارالبيضاء','الدار البيضاء','dar el beida','darelbeida'].some(k => c.includes(k.replace(/[\s\-]/g, '')));
};

export default function ListeColisPage({ orders, setOrders, isLoading, onDeleteOrder, fetchDeletedOrders, restoreOrder }) {
  const [tab] = useState('colis');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [pgPage, setPgPage] = useState(1);
  const [pgPer, setPgPer] = useState(10);
  const [showArchived, setShowArchived] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [trashOrders, setTrashOrders] = useState([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  async function openTrash() {
    setShowTrash(true);
    setTrashLoading(true);
    try { setTrashOrders(await fetchDeletedOrders?.() || []); }
    finally { setTrashLoading(false); }
  }
  async function handleRestore(id) {
    setRestoringId(id);
    try {
      const ok = await restoreOrder?.(id);
      if (ok) { setTrashOrders(prev => prev.filter(o => o.id !== id)); toast.success('Commande restaurée'); }
      else toast.error('Échec de la restauration');
    } finally { setRestoringId(null); }
  }
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
  // Re-clic sur « Liste des Colis » dans la barre latérale → actualiser (reset complet).
  useEffect(() => {
    const onReclick = (e) => {
      if (e.detail?.path && e.detail.path !== '/liste-colis') return;
      setSearch(''); setFilterForm(emptyFilter); setAppliedFilter(emptyFilter);
      setPgPage(1); setSelected([]); setShowArchived(false);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('route-reclick', onReclick);
    return () => window.removeEventListener('route-reclick', onReclick);
  }, []);

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
  const [editOrder, setEditOrder] = useState(null);
  const [editOrderFull, setEditOrderFull] = useState(null);
  const [deliveryOrder, setDeliveryOrder] = useState(null);
  const [historyOrder, setHistoryOrder] = useState(null);
  const [selected, setSelected] = useState([]);
  const [showScanner, setShowScanner] = useState(false);
  const toast = useToast();

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
    const current = orders.find(o => o.id === orderId);
    const removing = (current?.recu || recuIds.has(orderId));
    const next = new Set(recuIds);
    if (removing) { next.delete(orderId); } else { next.add(orderId); }
    setRecuIds(next);
    localStorage.setItem('victoury_recu_ids', JSON.stringify([...next]));
    // fusionner avec le cloud avant d'écrire pour ne pas écraser les scans d'autres appareils
    cloudGet('victoury_recu_ids').then(cloud => {
      const merged = new Set([...(Array.isArray(cloud) ? cloud : []), ...next]);
      if (removing) merged.delete(orderId);
      localStorage.setItem('victoury_recu_ids', JSON.stringify([...merged]));
      cloudSet('victoury_recu_ids', [...merged]);
    }).catch(() => cloudSet('victoury_recu_ids', [...next]));
    // source de vérité : colonne recu de la table orders (synchro realtime)
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, recu: !removing } : o));
    supabase.from('orders').update({ recu: !removing }).eq('id', orderId).then(() => {});
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
    const pageIds = pagedColis.map((o) => o.id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
    if (allSelected) {
      setSelected((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelected((prev) => [...new Set([...prev, ...pageIds])]);
    }
  }

  /* Show only orders in the colis pipeline */
  // Archive : commande terminée (livrée / retour ou échange reçu) et âgée de +45 jours
  const ARCHIVE_DAYS = 45;
  const ARCHIVE_STATES = ['livre', 'retour_recu', 'echange_recu'];
  const isArchived = (o) => {
    if (!ARCHIVE_STATES.includes(o.status)) return false;
    const d = parseFrDate(o.dateAdded);
    if (!d) return false;
    return (Date.now() - d.getTime()) > ARCHIVE_DAYS * 86400000;
  };

  const colis = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    const af = appliedFilter;
    return orders.filter((o) => {
      const inPipeline = COLIS_PIPELINE.includes(o.status) || (!!o.trackingNumber && !!o.validated);
      if (!inPipeline) return false;
      // La recherche traverse tout (actifs + archives). Sans recherche : vue active masque
      // les archivées, vue archives ne montre qu'elles.
      if (!q && (showArchived ? !isArchived(o) : isArchived(o))) return false;
      // Recherche par téléphone : on compare aussi la version normalisée (0 initial rétabli),
      // et on retire tout ce qui n'est pas chiffre dans la requête pour tolérer espaces/tirets.
      const qDigits = q.replace(/\D/g, '');
      const matchSearch = !q ||
        o.id.toLowerCase().includes(q) ||
        o.recipient.name.toLowerCase().includes(q) ||
        o.recipient.city.toLowerCase().includes(q) ||
        (o.trackingNumber || '').toLowerCase().includes(q) ||
        (o.recipient.phone || '').toLowerCase().includes(q) ||
        (qDigits && normalizePhone(o.recipient.phone).includes(qDigits));
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
        if (!d) return false;
        if (af.dateFrom && d < new Date(af.dateFrom + 'T00:00:00')) return false;
        if (af.dateTo && d > new Date(af.dateTo + 'T23:59:59')) return false;
      }
      return true;
    });
  }, [orders, debouncedSearch, appliedFilter, showArchived]);

  const archivedCount = useMemo(() => orders.reduce((n, o) => {
    const inPipeline = COLIS_PIPELINE.includes(o.status) || (!!o.trackingNumber && !!o.validated);
    return n + (inPipeline && isArchived(o) ? 1 : 0);
  }, 0), [orders]);

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
    <div className="flex flex-col h-full p-4 gap-3 animate-pulse">
      <div className="h-9 w-48 bg-gray-200 rounded-lg" />
      <div className="h-10 w-full bg-gray-200 rounded-xl" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-14 w-full bg-gray-200 rounded-xl" />
      ))}
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
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 pl-16 sm:pl-6 flex items-center flex-wrap gap-x-3 gap-y-2">
        <span className="font-bold text-gray-700 text-base">{showArchived ? 'Archives' : 'Liste des colis'}</span>
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{colis.length}</span>
        {(showArchived || archivedCount > 0) && (
          <button
            onClick={() => { setShowArchived(v => !v); setPgPage(1); }}
            className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border transition ${showArchived ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
            title="Commandes livrées de plus de 45 jours"
          >
            📦 {showArchived ? 'Retour aux colis actifs' : `Archives (${archivedCount})`}
          </button>
        )}
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
          <button onClick={() => exportColisCSV(colis)} className="p-2 rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors" title="Exporter CSV">
            <Download size={14} />
          </button>
          <button onClick={() => {
            const toPrint = selected.length > 0 ? colis.filter(o => selected.includes(o.id)) : colis;
            if (toPrint.length === 0) return;
            openLabelPage(toPrint);
          }} className="p-2 rounded-lg border border-rose-100 bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors" title="Imprimer étiquettes">
            <Printer size={14} />
          </button>
          <button onClick={() => setShowScanner(true)} className="p-2 rounded-lg border border-violet-100 bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors" title="Scanner un colis">
            <ScanLine size={14} />
          </button>
          <button onClick={openTrash} className="p-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors" title="Corbeille — restaurer des commandes supprimées">
            <Trash2 size={14} />
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
              {/* Raccourcis de période */}
              <div className="flex flex-wrap items-center gap-1.5 mt-3">
                <span className="text-xs text-gray-500 font-semibold mr-1">Période :</span>
                {[
                  { label: "Aujourd'hui", days: 0 },
                  { label: '7 jours', days: 6 },
                  { label: '30 jours', days: 29 },
                  { label: 'Ce mois', month: true },
                ].map(preset => (
                  <button key={preset.label}
                    onClick={() => {
                      const to = new Date();
                      const from = preset.month
                        ? new Date(to.getFullYear(), to.getMonth(), 1)
                        : new Date(to.getTime() - preset.days * 86400000);
                      const iso = (d) => d.toISOString().slice(0, 10);
                      setFilterForm(p => ({ ...p, dateFrom: iso(from), dateTo: iso(to) }));
                    }}
                    className="px-2.5 py-1 rounded-full border border-gray-300 text-xs text-gray-700 hover:bg-blue-50 hover:border-blue-300 transition">
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3">
                {/* Du (date d'ajout) */}
                <div>
                  <label className="block text-xs text-gray-500 font-semibold mb-1">Du</label>
                  <input type="date" value={filterForm.dateFrom} onChange={e => setFilterForm(p => ({ ...p, dateFrom: e.target.value }))} className="w-full bg-white border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-blue-400" />
                </div>
                {/* Au (date d'ajout) */}
                <div>
                  <label className="block text-xs text-gray-500 font-semibold mb-1">Au</label>
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

      {/* Table */}
      <div className="flex-1 overflow-auto px-4 pb-4">
      <div className="border border-gray-200 rounded-xl overflow-x-auto shadow-sm">
        <table className="w-full text-sm border-collapse min-w-[900px] table">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <tr>
                <th className="px-4 py-3 w-8">
                <input type="checkbox" checked={pagedColis.length > 0 && pagedColis.every((o) => selected.includes(o.id))} onChange={toggleAll} className="w-4 h-4 rounded" />
              </th>
            {['Destinataire', 'Produits', 'Prix', 'État', 'Note', 'LIV', 'Date', 'Validé', 'Action'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
        </table>
        <div className="block">
        <table className="w-full text-sm border-separate border-spacing-y-1 min-w-[900px] [&_tbody_td]:align-top">
          <tbody>
            {colis.length === 0 ? (
              <tr><td colSpan={10} className="py-16 text-center text-gray-400 text-sm">
                <div className="flex flex-col items-center gap-2">
                  <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                  <span>Aucun colis dans le pipeline</span>
                </div>
              </td></tr>
            ) : pagedColis.map((o, idx) => {
              const note = (o.note || '').replace('Note interne: ', '').trim();
              const delivery = o.recipient?.delivery || '—';
              return (
                <tr key={o.id} className={`border rounded-xl transition-all ${selected.includes(o.id) ? 'bg-indigo-50 border-indigo-300 shadow-sm' : isCasa(o.recipient?.city) ? 'bg-sky-50/70 border-sky-300 hover:bg-sky-100/60' : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'}`}>
                  {/* Checkbox */}
                  <td className="px-4 py-3 w-8">
                    <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggleSelect(o.id)} className="w-4 h-4 rounded" />
                  </td>
                  {/* Destinataire */}
                  <td className="px-4 py-4 min-w-[220px]">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-sm font-bold text-orange-600 font-mono">{o.trackingNumber || o.id}</span>
                      {o.trackingNumber && (
                        <button
                          onClick={() => navigator.clipboard.writeText(o.trackingNumber).then(() => toast.success('Copié !')).catch(() => {})}
                          className="p-0.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Copier le numéro de suivi"
                        >
                          <Copy size={11} />
                        </button>
                      )}
                    </div>
                    <div className="text-base font-bold text-gray-900 break-words">{o.recipient.name}</div>
                    <div className="text-sm text-gray-500 mt-0.5 break-words">{o.recipient.address}</div>
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
                      <div key={i} className="text-sm leading-snug mb-0.5 break-words">
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
                    <div className="flex flex-col items-start gap-1">
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
                        className={`text-[10px] px-1.5 py-0.5 rounded-full border font-semibold transition-colors ${
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
                        className={`text-[10px] px-1.5 py-0.5 rounded-full border font-semibold transition-colors ${
                          facturedIds.has(o.id)
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200'
                            : 'bg-gray-100 text-gray-500 border-gray-300 hover:bg-yellow-50 hover:border-yellow-300 hover:text-yellow-700'
                        }`}
                      >
                        {facturedIds.has(o.id) ? '✓ Facturé' : 'Pas facturé'}
                      </button>
                    )}
                    {(o.status === 'refuse' || o.status === 'annule' || o.status === 'retour_recu') && (
                      <button
                        onClick={() => toggleRecu(o.id)}
                        className={`inline-flex items-center gap-1 whitespace-nowrap text-[10px] px-2 py-0.5 rounded font-bold text-white transition-colors ${
                          (o.recu || recuIds.has(o.id))
                            ? 'bg-green-600 hover:bg-green-700'
                            : 'bg-red-800 hover:bg-red-900'
                        }`}
                      >
                        {(o.recu || recuIds.has(o.id)) ? 'Reçu' : 'Non-reçu'}
                        <span className="text-[8px]">▼</span>
                      </button>
                    )}
                    </div>
                  </td>

                  {/* Note */}
                  <td className="px-4 py-3 max-w-[250px]">
                    {note && <span className="text-sm text-gray-700 font-medium whitespace-pre-wrap break-words">Note interne:<br/>{note}</span>}
                    {o.noteLivraison && (
                      <span className={`text-sm text-red-600 font-semibold whitespace-pre-wrap break-words ${note ? 'block mt-2' : ''}`}>
                        Note livraison:<br/>{o.noteLivraison}
                      </span>
                    )}
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

                  {/* Validé — interrupteur vert ; le désactiver renvoie la commande en Confirmé */}
                  <td className="px-4 py-3 text-center">
                    <Toggle
                      checked={o.validated !== false}
                      loading={false}
                      onChange={(next) => { if (!next) deactivateOrder(o.id); }}
                    />
                  </td>

                  {/* Action */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5">
                      <button
                        onClick={() => setEditOrderFull(o)}
                        className="p-1.5 rounded bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                        title="Modifier la commande"
                        aria-label="Modifier"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setDeliveryOrder(o)}
                        className="p-1.5 rounded bg-amber-100 text-amber-600 hover:bg-amber-200 transition-colors"
                        title="Statut livraison"
                        aria-label="Livraison"
                      >
                        <Truck size={13} />
                      </button>
                      <button
                        onClick={() => setHistoryOrder(o)}
                        className="p-1.5 rounded bg-purple-100 text-purple-600 hover:bg-purple-200 transition-colors"
                        title="Historique"
                        aria-label="Historique"
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

        {/* Mobile card view (désactivé — on garde le tableau sur mobile) */}
        <div className="hidden">
          {colis.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm flex flex-col items-center gap-2">
              <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
              <span>Aucun colis dans le pipeline</span>
            </div>
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
                  <button onClick={() => setEditOrderFull(o)} className="p-1.5 rounded bg-blue-100 text-blue-600 hover:bg-blue-200" title="Modifier" aria-label="Modifier">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => setDeliveryOrder(o)} className="p-1.5 rounded bg-amber-100 text-amber-600 hover:bg-amber-200" title="Livraison" aria-label="Livraison">
                    <Truck size={13} />
                  </button>
                  <button onClick={() => setHistoryOrder(o)} className="p-1.5 rounded bg-purple-100 text-purple-600 hover:bg-purple-200" title="Historique" aria-label="Historique">
                    <Clock size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
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
          onDeleteOrder={onDeleteOrder}
        />
      )}

      {showTrash && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowTrash(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Trash2 size={18} className="text-gray-500" />
                <h2 className="font-bold text-gray-900">Corbeille</h2>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-semibold">{trashOrders.length}</span>
              </div>
              <button onClick={() => setShowTrash(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto p-3">
              {trashLoading ? (
                <div className="py-10 text-center text-gray-400 text-sm">Chargement…</div>
              ) : trashOrders.length === 0 ? (
                <div className="py-10 text-center text-gray-400 text-sm">Aucune commande supprimée.</div>
              ) : trashOrders.map(o => (
                <div key={o.id} className="flex items-center gap-3 px-3 py-2.5 border border-gray-100 rounded-xl mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-orange-600 font-mono">{o.trackingNumber || o.id}</div>
                    <div className="text-sm font-semibold text-gray-800 truncate">{o.recipient?.name || '—'}</div>
                    <div className="text-xs text-gray-500 truncate">{o.recipient?.city} · {Number(o.price || 0).toFixed(2)} DH · {o.dateAdded || ''}</div>
                  </div>
                  <button
                    onClick={() => handleRestore(o.id)}
                    disabled={restoringId === o.id}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    {restoringId === o.id ? '…' : 'Restaurer'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
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

      {showScanner && (
        <ScanModal
          orders={colis}
          onFound={(id) => {
            setSelected(prev => [...new Set([...prev, id])]);
            setShowScanner(false);
            const ord = colis.find(o => o.id === id);
            if (ord) setEditOrderFull(ord);
            toast.success('Colis trouvé !');
          }}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* WhatsApp Notification Popup */}
      {whatsappPopup && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" onKeyDown={e => { if (e.key === 'Escape') setWhatsappPopup(null); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-green-50">
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-green-600 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.61.61l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.37 0-4.567-.816-6.3-2.183l-.44-.348-2.865.96.96-2.865-.348-.44A9.965 9.965 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                <span className="font-bold text-green-800 text-sm">Envoyer WhatsApp</span>
              </div>
              <button onClick={() => setWhatsappPopup(null)} className="p-1 hover:bg-gray-100 rounded" aria-label="Fermer"><X size={15} className="text-gray-400" /></button>
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
