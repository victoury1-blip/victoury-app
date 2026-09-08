import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, X, Pencil, Trash2, Car, Search, FileText, Wrench } from 'lucide-react';
import { cloudGet, cloudSet } from '../lib/cloudSettings';
import { useToast } from './Toast';
import useSearchShortcut from '../hooks/useSearchShortcut';

const STORAGE_KEY = 'victoury_voiture_depenses';

/* Deux catégories seulement : les papiers (assurance, vignette, contrôle
   technique...) et la réparation/entretien. Toute autre dépense se range
   dans l'une des deux — pas de troisième catégorie pour ne pas diluer le
   suivi. */
const CATEGORIES = [
  { value: 'papiers',    label: 'Papiers',    color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'reparation', label: 'Réparation', color: 'bg-amber-50 text-amber-700 border-amber-200' },
];
const catOf = (v) => CATEGORIES.find(c => c.value === v) || CATEGORIES[0];

const norm = (s) => (s || '').toString().toLowerCase().trim();

const fieldCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300';
const inputCls = `w-full ${fieldCls}`;

/** Date du jour au format jj/mm/aaaa, pour préremplir le formulaire. */
function todayFr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/* jj/mm/aaaa -> Date, pour calculer mois/année sans dépendre du format
   local du navigateur. Une date illisible retombe sur aujourd'hui plutôt
   que de casser les totaux. */
function parseFr(dateStr) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((dateStr || '').trim());
  if (!m) return new Date();
  return new Date(+m[3], +m[2] - 1, +m[1]);
}

function DepenseModal({ depense, onClose, onSave }) {
  const [form, setForm] = useState(() => depense || {
    titre: '', montant: '', categorie: 'papiers', date: todayFr(), note: '',
  });
  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const invalide = !form.titre.trim() || !(parseFloat(form.montant) > 0);

  function save() {
    if (invalide) return;
    onSave({
      id: depense?.id || `V${Date.now()}${Math.floor(Math.random() * 1000)}`,
      titre: form.titre.trim(),
      montant: parseFloat(form.montant) || 0,
      categorie: form.categorie,
      date: form.date.trim() || todayFr(),
      note: form.note.trim(),
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-900 rounded-t-2xl shrink-0">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Car size={16} /> {depense ? 'Modifier' : 'Nouvelle'} dépense voiture
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700 text-gray-300"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Titre</label>
            <input value={form.titre} onChange={e => u('titre', e.target.value)} className={inputCls} placeholder="Ex: Vidange, Assurance..." autoFocus />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Catégorie</label>
            <div className="flex gap-2">
              {CATEGORIES.map(c => (
                <button key={c.value} type="button" onClick={() => u('categorie', c.value)}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition ${
                    form.categorie === c.value ? c.color : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Montant (DH)</label>
            <input type="number" min="0" step="0.01" inputMode="decimal" value={form.montant}
              onChange={e => u('montant', e.target.value)} className={inputCls + ' font-bold'} placeholder="0" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Date de paiement</label>
            <input value={form.date} onChange={e => u('date', e.target.value)} className={inputCls} placeholder="jj/mm/aaaa" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Note (facultatif)</label>
            <input value={form.note} onChange={e => u('note', e.target.value)} className={inputCls} placeholder="Détail, garage, référence..." />
          </div>
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200">Annuler</button>
          <button onClick={save} disabled={invalide}
            className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40">
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VoiturePage() {
  const toast = useToast();

  const [depenses, setDepenses] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [modalItem, setModalItem] = useState(null);
  const [search, setSearch] = useState('');
  const searchRef = useRef(null);
  useSearchShortcut(searchRef);

  useEffect(() => {
    cloudGet(STORAGE_KEY).then(remote => {
      if (Array.isArray(remote) && remote.length) setDepenses(remote);
    }).catch(() => {});
  }, []);

  function persist(next) {
    setDepenses(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    cloudSet(STORAGE_KEY, next);
  }

  function openAddModal() {
    setModalItem(null);
    setModalOpen(true);
  }

  function saveItem(item) {
    let next;
    if (modalItem) {
      next = depenses.map(d => d.id === item.id ? item : d);
      toast.success('Dépense modifiée');
    } else {
      next = [item, ...depenses];
      toast.success('Dépense ajoutée');
    }
    persist(next);
    setModalOpen(false);
    setModalItem(null);
  }

  function deleteItem(id) {
    if (!confirm('Supprimer cette dépense ?')) return;
    persist(depenses.filter(d => d.id !== id));
  }

  const now = new Date();

  const totals = useMemo(() => {
    let total = 0, papiers = 0, reparation = 0, mois = 0, annee = 0;
    for (const d of depenses) {
      const montant = parseFloat(d.montant) || 0;
      total += montant;
      if (d.categorie === 'reparation') reparation += montant; else papiers += montant;
      const dt = parseFr(d.date);
      if (dt.getFullYear() === now.getFullYear()) {
        annee += montant;
        if (dt.getMonth() === now.getMonth()) mois += montant;
      }
    }
    return { total, papiers, reparation, mois, annee };
  }, [depenses]);

  const visibleDepenses = useMemo(() => {
    const q = norm(search);
    const list = !q ? depenses : depenses.filter(d => norm(d.titre).includes(q) || norm(d.note).includes(q));
    // Plus récent en premier, à date de paiement égale on garde l'ordre d'ajout.
    return [...list].sort((a, b) => parseFr(b.date) - parseFr(a.date));
  }, [depenses, search]);

  return (
    <div className="p-4 sm:p-6 page-enter">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-xl bg-red-100"><Car size={18} className="text-red-600" /></span>
          <h1 className="text-xl font-bold text-gray-800">Voiture</h1>
        </div>
        <button onClick={openAddModal}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
          <Plus size={16} /> Ajouter
        </button>
      </div>

      {/* Résumé global */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <SummaryCard label="Total dépensé" value={`${totals.total.toLocaleString('fr-FR')} DH`} color="text-red-600" />
        <SummaryCard label="Ce mois" value={`${totals.mois.toLocaleString('fr-FR')} DH`} color="text-gray-800" />
        <SummaryCard label="Cette année" value={`${totals.annee.toLocaleString('fr-FR')} DH`} color="text-gray-800" />
        <SummaryCard label="Papiers" value={`${totals.papiers.toLocaleString('fr-FR')} DH`} color="text-blue-600" />
        <SummaryCard label="Réparation" value={`${totals.reparation.toLocaleString('fr-FR')} DH`} color="text-amber-600" />
      </div>

      <div className="relative mb-4 max-w-xs">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher... (/)" className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
      </div>

      {visibleDepenses.length === 0 && (
        <div className="border border-gray-200 rounded-xl bg-white p-10 text-center shadow-sm">
          <FileText size={44} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 mb-1">Aucune dépense enregistrée</p>
          <p className="text-xs text-gray-400">Cliquez « Ajouter » pour enregistrer une dépense voiture.</p>
        </div>
      )}

      <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm min-w-[560px] border-separate border-spacing-y-1">
          <thead className="bg-gray-50">
            <tr>
              {['Titre', 'Catégorie', 'Date', 'Montant', 'Note', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleDepenses.map((d, idx) => {
              const c = catOf(d.categorie);
              return (
                <tr key={d.id} className={idx % 2 ? 'bg-gray-50 border border-gray-200 rounded-xl' : 'bg-white border border-gray-200 rounded-xl'}>
                  <td className="px-4 py-3 font-semibold text-gray-800 flex items-center gap-2">
                    {d.categorie === 'reparation' ? <Wrench size={14} className="text-amber-500 shrink-0" /> : <FileText size={14} className="text-blue-500 shrink-0" />}
                    {d.titre}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border whitespace-nowrap ${c.color}`}>{c.label}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{d.date}</td>
                  <td className="px-4 py-3 text-gray-800 font-bold whitespace-nowrap">{(d.montant || 0).toLocaleString('fr-FR')} DH</td>
                  <td className="px-4 py-3 text-gray-400 text-xs truncate max-w-[200px]">{d.note || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setModalItem(d); setModalOpen(true); }}
                        className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50" title="Modifier"><Pencil size={14} /></button>
                      <button onClick={() => deleteItem(d.id)}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-50" title="Supprimer"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <DepenseModal
          depense={modalItem}
          onClose={() => { setModalOpen(false); setModalItem(null); }}
          onSave={saveItem}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value, color, hint }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
      <p className="text-[11px] text-gray-400 uppercase font-semibold mb-1">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      {hint && <p className="text-[10px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}
