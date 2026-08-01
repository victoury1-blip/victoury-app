import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, X, Pencil, Trash2, Truck, Package, Search } from 'lucide-react';
import { cloudGet, cloudSet } from '../lib/cloudSettings';
import { useToast } from './Toast';
import useSearchShortcut from '../hooks/useSearchShortcut';

const STORAGE_KEY = 'victoury_fournisseur';

/* Statuts « sortis » : la pièce a quitté le stock (expédiée / livrée / échangée). */
const SOLD_STATUSES = new Set(['expedier', 'recu_livreur', 'livre', 'change']);

const norm = (s) => (s || '').toString().toLowerCase().trim();

/* Parse une date "JJ/MM/AAAA HH:mm" (fr-MA) en objet Date. */
function parseFrDate(str) {
  if (!str) return null;
  const [datePart, timePart] = String(str).split(' ');
  const [d, m, y] = (datePart || '').split('/');
  if (!d || !m || !y) return null;
  const [hh = '0', mm = '0'] = (timePart || '').split(':');
  const dt = new Date(+y, +m - 1, +d, +hh, +mm);
  return isNaN(dt.getTime()) ? null : dt;
}

/* Lundi 00:00 de la semaine en cours. */
function startOfWeek() {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // 0 = lundi
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day, 0, 0, 0);
  return monday;
}

/* Un produit de commande correspond-il à l'article fournisseur (modèle + couleur) ? */
function matchProduct(prod, item) {
  if (!prod) return false;
  const pname = norm(prod.name);
  const model = norm(item.modele);
  // Un nom de produit vide ne doit JAMAIS matcher (sinon model.includes('') === true).
  if (model && (!pname || !(pname.includes(model) || model.includes(pname)))) return false;
  const color = norm(item.couleur);
  if (color) {
    const hay = `${norm(prod.name)} ${norm(prod.color)} ${norm(prod.size)}`;
    // n'importe laquelle des couleurs saisies (séparées par virgule) suffit
    const colors = color.split(',').map(c => c.trim()).filter(Boolean);
    if (!colors.some(c => hay.includes(c))) return false;
  }
  return true;
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300';

function ItemModal({ item, onClose, onSave }) {
  const [form, setForm] = useState(() => item || { modele: '', couleur: '', prix: '', quantite: '', dateAchat: '' });
  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const total = (parseFloat(form.prix) || 0) * (parseInt(form.quantite, 10) || 0);

  function save() {
    if (!form.modele.trim()) return;
    onSave({
      id: item?.id || `F${Date.now()}`,
      modele: form.modele.trim(),
      couleur: form.couleur.trim(),
      prix: parseFloat(form.prix) || 0,
      quantite: parseInt(form.quantite, 10) || 0,
      dateAchat: form.dateAchat || new Date().toLocaleDateString('fr-FR'),
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-900 rounded-t-2xl">
          <h2 className="text-base font-bold text-white flex items-center gap-2"><Truck size={16} /> {item ? 'Modifier' : 'Nouvel'} article fournisseur</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700 text-gray-300"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Modèle</label>
            <input value={form.modele} onChange={e => u('modele', e.target.value)} className={inputCls} placeholder="Ex: Ensemble Sporte Bleu marine" autoFocus />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Couleur(s) <span className="text-gray-400 font-normal">— séparées par virgule</span></label>
            <input value={form.couleur} onChange={e => u('couleur', e.target.value)} className={inputCls} placeholder="Ex: bleu, noir" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Prix unitaire (DH)</label>
              <input type="number" inputMode="decimal" value={form.prix} onChange={e => u('prix', e.target.value)} className={inputCls} placeholder="0" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Quantité prise</label>
              <input type="number" inputMode="numeric" value={form.quantite} onChange={e => u('quantite', e.target.value)} className={inputCls} placeholder="0" />
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-gray-500 font-semibold">Total (coût)</span>
            <span className="text-lg font-bold text-gray-800">{total.toLocaleString('fr-FR')} DH</span>
          </div>
        </div>
        <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200">Annuler</button>
          <button onClick={save} className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

export default function FournisseurPage({ orders = [] }) {
  const toast = useToast();
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  });
  const [modalItem, setModalItem] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef(null);
  useSearchShortcut(searchRef);

  // Chargement distant (cloud) au montage.
  useEffect(() => {
    cloudGet(STORAGE_KEY).then(remote => {
      if (Array.isArray(remote)) setItems(remote);
    }).catch(() => {});
  }, []);

  function persist(next) {
    setItems(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    cloudSet(STORAGE_KEY, next);
  }

  function saveItem(item) {
    const exists = items.some(i => i.id === item.id);
    persist(exists ? items.map(i => i.id === item.id ? item : i) : [item, ...items]);
    setModalOpen(false);
    setModalItem(null);
    toast.success(exists ? 'Article modifié' : 'Article ajouté');
  }

  function deleteItem(id) {
    if (!confirm('Supprimer cet article ?')) return;
    persist(items.filter(i => i.id !== id));
  }

  const weekStart = useMemo(() => startOfWeek(), []);

  /* Ventes par article : total sorti + sorti cette semaine. */
  const stats = useMemo(() => {
    const map = {};
    for (const item of items) map[item.id] = { total: 0, semaine: 0 };
    for (const o of orders) {
      if (!SOLD_STATUSES.has(o.status)) continue;
      const prods = (o.products && o.products.length) ? o.products : (o.product ? [o.product] : []);
      const d = parseFrDate(o.dateUpdated) || parseFrDate(o.dateAdded);
      const inWeek = d && d >= weekStart;
      for (const p of prods) {
        // Chaque pièce vendue est attribuée à UN SEUL article fournisseur (le premier
        // qui matche) pour ne pas compter deux fois quand des lignes se recoupent.
        const item = items.find(it => matchProduct(p, it));
        if (!item) continue;
        const q = parseInt(p.qty, 10) || 1;
        map[item.id].total += q;
        if (inWeek) map[item.id].semaine += q;
      }
    }
    return map;
  }, [items, orders, weekStart]);

  const filtered = useMemo(() => {
    const q = norm(search);
    if (!q) return items;
    return items.filter(i => norm(i.modele).includes(q) || norm(i.couleur).includes(q));
  }, [items, search]);

  const totals = useMemo(() => {
    let cout = 0, qte = 0, venduTotal = 0, venduSemaine = 0;
    for (const i of items) {
      cout += (i.prix || 0) * (i.quantite || 0);
      qte += i.quantite || 0;
      venduTotal += stats[i.id]?.total || 0;
      venduSemaine += stats[i.id]?.semaine || 0;
    }
    return { cout, qte, venduTotal, venduSemaine, reste: qte - venduTotal };
  }, [items, stats]);

  return (
    <div className="p-4 sm:p-6 page-enter">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-xl bg-amber-100"><Truck size={18} className="text-amber-600" /></span>
          <h1 className="text-xl font-bold text-gray-800">Fournisseur</h1>
        </div>
        <button onClick={() => { setModalItem(null); setModalOpen(true); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
          <Plus size={16} /> Ajouter
        </button>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <SummaryCard label="Coût total" value={`${totals.cout.toLocaleString('fr-FR')} DH`} color="text-gray-800" />
        <SummaryCard label="Qté prise" value={totals.qte} color="text-blue-600" />
        <SummaryCard label="Vendu (semaine)" value={totals.venduSemaine} color="text-emerald-600" />
        <SummaryCard label="Vendu (total)" value={totals.venduTotal} color="text-emerald-700" />
        <SummaryCard label="Reste" value={totals.reste} color={totals.reste < 0 ? 'text-red-600' : 'text-amber-600'} />
      </div>

      <div className="relative mb-3 max-w-xs">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher... (/)" className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Modèle', 'Couleur(s)', 'Prix U.', 'Qté prise', 'Total (coût)', 'Vendu (sem.)', 'Vendu (tot.)', 'Reste', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">
                <Package size={40} className="mx-auto mb-2 text-gray-300" />
                Aucun article fournisseur
              </td></tr>
            )}
            {filtered.map((i, idx) => {
              const s = stats[i.id] || { total: 0, semaine: 0 };
              const reste = (i.quantite || 0) - s.total;
              return (
                <tr key={i.id} className={idx % 2 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="px-4 py-3 font-semibold text-gray-800">{i.modele}</td>
                  <td className="px-4 py-3 text-gray-600">{i.couleur || '—'}</td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{(i.prix || 0).toLocaleString('fr-FR')} DH</td>
                  <td className="px-4 py-3 text-blue-600 font-semibold">{i.quantite || 0}</td>
                  <td className="px-4 py-3 text-gray-800 font-bold whitespace-nowrap">{((i.prix || 0) * (i.quantite || 0)).toLocaleString('fr-FR')} DH</td>
                  <td className="px-4 py-3 text-emerald-600 font-semibold">{s.semaine}</td>
                  <td className="px-4 py-3 text-emerald-700 font-semibold">{s.total}</td>
                  <td className={`px-4 py-3 font-bold ${reste < 0 ? 'text-red-600' : 'text-amber-600'}`}>{reste}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setModalItem(i); setModalOpen(true); }} className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50" title="Modifier"><Pencil size={14} /></button>
                      <button onClick={() => deleteItem(i.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50" title="Supprimer"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-3">
        « Vendu » = pièces sorties (Expédié, Reçu livreur, Livré, Échange). « Reste » se décrémente automatiquement à chaque commande sortie correspondante (modèle + couleur).
      </p>

      {modalOpen && (
        <ItemModal item={modalItem} onClose={() => { setModalOpen(false); setModalItem(null); }} onSave={saveItem} />
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
      <p className="text-[11px] text-gray-400 uppercase font-semibold mb-1">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}
