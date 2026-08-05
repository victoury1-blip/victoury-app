import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, X, Pencil, Trash2, Truck, Package, Search, Lock, FileText, Eye, EyeOff } from 'lucide-react';
import { cloudGet, cloudSet } from '../lib/cloudSettings';
import { useToast } from './Toast';
import useSearchShortcut from '../hooks/useSearchShortcut';

const STORAGE_KEY = 'victoury_fournisseur_factures';
const LEGACY_KEY = 'victoury_fournisseur'; // ancienne liste plate d'articles

const SIZE_OPTIONS = ['S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'];

/* Statuts « sortis » : la pièce a quitté le stock (expédiée / livrée / échangée). */
const SOLD_STATUSES = new Set(['expedier', 'recu_livreur', 'livre', 'change']);

const norm = (s) => (s || '').toString().toLowerCase().trim();

/* Parse une date "JJ/MM/AAAA HH:mm" (fr-MA) en objet Date. */
function parseFrDate(str) {
  if (!str) return null;
  const m = String(str).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const dt = new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  return isNaN(dt.getTime()) ? null : dt;
}

/* Lundi 00:00 de la semaine en cours. */
function startOfWeek() {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // 0 = lundi
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - day, 0, 0, 0);
}

/* Quantité totale d'un article = somme des quantités par taille. */
const itemQty = (it) => (it.sizes || []).reduce((n, s) => n + (parseInt(s.qte, 10) || 0), 0);
const itemCost = (it) => (parseFloat(it.prix) || 0) * itemQty(it);

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
    const colors = color.split(',').map(c => c.trim()).filter(Boolean);
    if (!colors.some(c => hay.includes(c))) return false;
  }
  return true;
}

const fieldCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300';
const inputCls = `w-full ${fieldCls}`;

/* ── Modal d'ajout / édition d'un article (avec tailles) ── */
function ItemModal({ item, onClose, onSave }) {
  const [form, setForm] = useState(() => item || { modele: '', couleur: '', prix: '', sizes: [{ taille: 'M', qte: '' }] });
  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const setSize = (idx, k, v) => setForm(p => ({ ...p, sizes: p.sizes.map((s, i) => i === idx ? { ...s, [k]: v } : s) }));
  const addSize = () => setForm(p => ({ ...p, sizes: [...p.sizes, { taille: '', qte: '' }] }));
  const removeSize = (idx) => setForm(p => ({ ...p, sizes: p.sizes.filter((_, i) => i !== idx) }));

  const qty = (form.sizes || []).reduce((n, s) => n + (parseInt(s.qte, 10) || 0), 0);
  const total = (parseFloat(form.prix) || 0) * qty;

  function save() {
    if (!form.modele.trim()) return;
    onSave({
      id: item?.id || `F${Date.now()}${Math.floor(Math.random() * 1000)}`,
      modele: form.modele.trim(),
      couleur: form.couleur.trim(),
      prix: parseFloat(form.prix) || 0,
      sizes: (form.sizes || [])
        .filter(s => s.taille && (parseInt(s.qte, 10) || 0) > 0)
        .map(s => ({ taille: s.taille.trim(), qte: parseInt(s.qte, 10) || 0 })),
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-900 rounded-t-2xl shrink-0">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Truck size={16} /> {item ? 'Modifier' : 'Nouvel'} article fournisseur
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700 text-gray-300"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Modèle</label>
            <input value={form.modele} onChange={e => u('modele', e.target.value)} className={inputCls} placeholder="Ex: Ensemble Sporte" autoFocus />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Couleur(s) <span className="text-gray-400 font-normal">— séparées par virgule</span>
            </label>
            <input value={form.couleur} onChange={e => u('couleur', e.target.value)} className={inputCls} placeholder="Ex: bleu, noir" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Prix unitaire (DH)</label>
            <input type="number" inputMode="decimal" value={form.prix} onChange={e => u('prix', e.target.value)} className={inputCls} placeholder="0" />
          </div>

          {/* Tailles + quantité par taille */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-gray-500">Tailles &amp; quantités</label>
              <button onClick={addSize} className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <Plus size={13} /> Ajouter une taille
              </button>
            </div>
            <div className="space-y-2">
              {(form.sizes || []).map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  {/* Le sélecteur de taille doit être LARGE pour que la taille reste lisible. */}
                  <select value={s.taille} onChange={e => setSize(i, 'taille', e.target.value)}
                    className={`${fieldCls} flex-1 min-w-0 font-semibold text-gray-800 bg-white`}>
                    <option value="">Taille…</option>
                    {SIZE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input type="number" inputMode="numeric" value={s.qte} onChange={e => setSize(i, 'qte', e.target.value)}
                    className={`${fieldCls} w-20 shrink-0 text-center`} placeholder="Qté" />
                  <button onClick={() => removeSize(i)} className="p-2 rounded-lg text-red-400 hover:bg-red-50 shrink-0" title="Retirer">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              {(form.sizes || []).length === 0 && (
                <p className="text-xs text-gray-400">Aucune taille — cliquez « Ajouter une taille ».</p>
              )}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-gray-500 font-semibold">Quantité totale : <span className="text-blue-600 font-bold">{qty}</span></span>
            <span className="text-lg font-bold text-gray-800">{total.toLocaleString('fr-FR')} DH</span>
          </div>
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200">Annuler</button>
          <button onClick={save} className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

export default function FournisseurPage({ orders = [] }) {
  const toast = useToast();

  /* Factures fournisseur : { id, ref, date, status: 'ouverte'|'cloturee', items: [] } */
  const [factures, setFactures] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
      // Migration depuis l'ancienne liste plate d'articles.
      const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]');
      if (Array.isArray(legacy) && legacy.length) {
        return [{
          id: `FA${Date.now()}`, ref: 'FRS-0001',
          date: new Date().toLocaleDateString('fr-FR'), status: 'ouverte',
          items: legacy.map(l => ({
            id: l.id, modele: l.modele, couleur: l.couleur, prix: l.prix,
            sizes: l.quantite ? [{ taille: '—', qte: l.quantite }] : [],
          })),
        }];
      }
    } catch {}
    return [];
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [modalItem, setModalItem] = useState(null);       // article en édition
  const [targetFactureId, setTargetFactureId] = useState(null);
  const [search, setSearch] = useState('');
  // Factures dépliées : le contenu n'apparaît qu'au clic sur l'œil (vue façon facture).
  const [expanded, setExpanded] = useState(() => new Set());
  const toggleExpand = (id) => setExpanded(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const searchRef = useRef(null);
  useSearchShortcut(searchRef);

  useEffect(() => {
    cloudGet(STORAGE_KEY).then(remote => {
      if (Array.isArray(remote) && remote.length) setFactures(remote);
    }).catch(() => {});
  }, []);

  function persist(next) {
    setFactures(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    cloudSet(STORAGE_KEY, next);
  }

  const openFacture = factures.find(f => f.status === 'ouverte') || null;

  function nextRef(list) {
    const max = list.reduce((m, f) => {
      const n = parseInt(String(f.ref || '').replace(/\D/g, ''), 10) || 0;
      return n > m ? n : m;
    }, 0);
    return `FRS-${String(max + 1).padStart(4, '0')}`;
  }

  /* Ajouter un article : va dans la facture ouverte ; s'il n'y en a pas
     (première fois ou dernière clôturée), une NOUVELLE facture est créée. */
  function openAddModal() {
    setModalItem(null);
    setTargetFactureId(openFacture?.id || null);
    setModalOpen(true);
  }

  function saveItem(item) {
    let next;
    if (modalItem) {
      // édition d'un article existant
      next = factures.map(f => ({ ...f, items: (f.items || []).map(i => i.id === item.id ? item : i) }));
      toast.success('Article modifié');
    } else {
      const targetId = targetFactureId || openFacture?.id;
      if (targetId) {
        next = factures.map(f => f.id === targetId ? { ...f, items: [...(f.items || []), item] } : f);
        toast.success('Article ajouté à la facture');
      } else {
        const facture = {
          id: `FA${Date.now()}`, ref: nextRef(factures),
          date: new Date().toLocaleDateString('fr-FR'), status: 'ouverte', items: [item],
        };
        next = [facture, ...factures];
        toast.success(`Nouvelle facture ${facture.ref} créée`);
      }
    }
    persist(next);
    setModalOpen(false);
    setModalItem(null);
    setTargetFactureId(null);
  }

  function cloturerFacture(id) {
    if (!confirm('Clôturer cette facture ? Le prochain article créera une nouvelle facture.')) return;
    persist(factures.map(f => f.id === id ? { ...f, status: 'cloturee' } : f));
    toast.success('Facture clôturée');
  }

  function rouvrirFacture(id) {
    // Une seule facture ouverte à la fois.
    persist(factures.map(f => f.id === id ? { ...f, status: 'ouverte' } : { ...f, status: 'cloturee' }));
  }

  function deleteFacture(id) {
    if (!confirm('Supprimer cette facture et tous ses articles ?')) return;
    persist(factures.filter(f => f.id !== id));
  }

  function deleteItem(factureId, itemId) {
    if (!confirm('Supprimer cet article ?')) return;
    persist(factures.map(f => f.id === factureId ? { ...f, items: (f.items || []).filter(i => i.id !== itemId) } : f));
  }

  const weekStart = useMemo(() => startOfWeek(), []);

  /* Ventes par article (tous factures confondues) + détail par taille. */
  const stats = useMemo(() => {
    const map = {};
    const allItems = [];
    for (const f of factures) for (const it of (f.items || [])) { map[it.id] = { total: 0, semaine: 0, bySize: {} }; allItems.push(it); }
    for (const o of orders) {
      if (!SOLD_STATUSES.has(o.status)) continue;
      const prods = (o.products && o.products.length) ? o.products : (o.product ? [o.product] : []);
      const d = parseFrDate(o.dateUpdated) || parseFrDate(o.dateAdded);
      const inWeek = d && d >= weekStart;
      for (const p of prods) {
        // Chaque pièce vendue est attribuée à UN SEUL article (le premier qui matche).
        const item = allItems.find(it => matchProduct(p, it));
        if (!item) continue;
        const q = parseInt(p.qty, 10) || 1;
        map[item.id].total += q;
        if (inWeek) map[item.id].semaine += q;
        const sz = (p.size || '').toString().trim().toUpperCase();
        if (sz) map[item.id].bySize[sz] = (map[item.id].bySize[sz] || 0) + q;
      }
    }
    return map;
  }, [factures, orders, weekStart]);

  const totals = useMemo(() => {
    let cout = 0, qte = 0, venduTotal = 0, venduSemaine = 0;
    for (const f of factures) for (const it of (f.items || [])) {
      cout += itemCost(it);
      qte += itemQty(it);
      venduTotal += stats[it.id]?.total || 0;
      venduSemaine += stats[it.id]?.semaine || 0;
    }
    return { cout, qte, venduTotal, venduSemaine, reste: qte - venduTotal };
  }, [factures, stats]);

  const visibleFactures = useMemo(() => {
    const q = norm(search);
    if (!q) return factures;
    return factures
      .map(f => ({ ...f, items: (f.items || []).filter(i => norm(i.modele).includes(q) || norm(i.couleur).includes(q)) }))
      .filter(f => f.items.length || norm(f.ref).includes(q));
  }, [factures, search]);

  return (
    <div className="p-4 sm:p-6 page-enter">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-xl bg-amber-100"><Truck size={18} className="text-amber-600" /></span>
          <h1 className="text-xl font-bold text-gray-800">Fournisseur</h1>
        </div>
        <button onClick={openAddModal}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
          <Plus size={16} /> Ajouter
        </button>
      </div>

      {/* Résumé global */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <SummaryCard label="Coût total" value={`${totals.cout.toLocaleString('fr-FR')} DH`} color="text-gray-800" />
        <SummaryCard label="Qté prise" value={totals.qte} color="text-blue-600" />
        <SummaryCard label="Vendu (semaine)" value={totals.venduSemaine} color="text-emerald-600" />
        <SummaryCard label="Vendu (total)" value={totals.venduTotal} color="text-emerald-700" />
        <SummaryCard label="Reste" value={totals.reste} color={totals.reste < 0 ? 'text-red-600' : 'text-amber-600'} />
      </div>

      <div className="relative mb-4 max-w-xs">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher... (/)" className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
      </div>

      {visibleFactures.length === 0 && (
        <div className="border border-gray-200 rounded-xl bg-white p-10 text-center shadow-sm">
          <Package size={44} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 mb-1">Aucune facture fournisseur</p>
          <p className="text-xs text-gray-400">Cliquez « Ajouter » : une facture sera créée automatiquement.</p>
        </div>
      )}

      <div className="space-y-5">
        {visibleFactures.map(f => {
          const fQte = (f.items || []).reduce((n, it) => n + itemQty(it), 0);
          const fCout = (f.items || []).reduce((n, it) => n + itemCost(it), 0);
          const fVendu = (f.items || []).reduce((n, it) => n + (stats[it.id]?.total || 0), 0);
          const ouverte = f.status === 'ouverte';
          return (
            <div key={f.id} className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
              {/* En-tête façon facture */}
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center gap-2 justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <button onClick={() => toggleExpand(f.id)}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 transition shrink-0"
                    title={expanded.has(f.id) ? 'Masquer le contenu' : 'Voir le contenu'}>
                    {expanded.has(f.id) ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <FileText size={16} className="text-gray-500 shrink-0" />
                  <span className="font-bold text-gray-800">{f.ref}</span>
                  <span className="text-xs text-gray-400">{f.date}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${
                    ouverte ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'
                  }`}>
                    {ouverte ? 'Ouverte' : 'Clôturée'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{fQte} pcs · <span className="font-bold text-gray-700">{fCout.toLocaleString('fr-FR')} DH</span> · vendu {fVendu}</span>
                  {ouverte ? (
                    <>
                      <button onClick={() => { setModalItem(null); setTargetFactureId(f.id); setModalOpen(true); }}
                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 rounded-lg font-semibold transition flex items-center gap-1">
                        <Plus size={13} /> Article
                      </button>
                      <button onClick={() => cloturerFacture(f.id)}
                        className="text-xs bg-gray-800 hover:bg-gray-900 text-white px-2.5 py-1.5 rounded-lg font-semibold transition flex items-center gap-1">
                        <Lock size={13} /> Clôturer
                      </button>
                    </>
                  ) : (
                    <button onClick={() => rouvrirFacture(f.id)}
                      className="text-xs border border-gray-300 text-gray-600 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg font-semibold transition">
                      Rouvrir
                    </button>
                  )}
                  <button onClick={() => deleteFacture(f.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50" title="Supprimer la facture">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Lignes de la facture — visibles seulement quand la facture est ouverte à l'œil */}
              {expanded.has(f.id) && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[820px]">
                  <thead className="bg-white border-b border-gray-200">
                    <tr>
                      {['Modèle', 'Couleur(s)', 'Tailles / Qté', 'Prix U.', 'Qté', 'Total', 'Vendu (sem.)', 'Vendu (tot.)', 'Reste', ''].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(f.items || []).length === 0 && (
                      <tr><td colSpan={10} className="px-4 py-6 text-center text-gray-400 text-xs">Facture vide — ajoutez un article.</td></tr>
                    )}
                    {(f.items || []).map((it, idx) => {
                      const s = stats[it.id] || { total: 0, semaine: 0, bySize: {} };
                      const q = itemQty(it);
                      const reste = q - s.total;
                      return (
                        <tr key={it.id} className={idx % 2 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="px-4 py-3 font-semibold text-gray-800">{it.modele}</td>
                          <td className="px-4 py-3 text-gray-600">{it.couleur || '—'}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {(it.sizes || []).length === 0 && <span className="text-gray-300 text-xs">—</span>}
                              {(it.sizes || []).map((sz, i) => {
                                const vendu = s.bySize[(sz.taille || '').toUpperCase()] || 0;
                                const rest = (parseInt(sz.qte, 10) || 0) - vendu;
                                return (
                                  <span key={i}
                                    className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border whitespace-nowrap ${
                                      rest < 0 ? 'bg-red-50 text-red-600 border-red-200'
                                        : rest === 0 ? 'bg-gray-100 text-gray-500 border-gray-200'
                                          : 'bg-blue-50 text-blue-700 border-blue-200'
                                    }`}
                                    title={`Pris ${sz.qte} · vendu ${vendu} · reste ${rest}`}>
                                    {sz.taille} : {rest}/{sz.qte}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{(it.prix || 0).toLocaleString('fr-FR')} DH</td>
                          <td className="px-4 py-3 text-blue-600 font-semibold">{q}</td>
                          <td className="px-4 py-3 text-gray-800 font-bold whitespace-nowrap">{itemCost(it).toLocaleString('fr-FR')} DH</td>
                          <td className="px-4 py-3 text-emerald-600 font-semibold">{s.semaine}</td>
                          <td className="px-4 py-3 text-emerald-700 font-semibold">{s.total}</td>
                          <td className={`px-4 py-3 font-bold ${reste < 0 ? 'text-red-600' : 'text-amber-600'}`}>{reste}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button onClick={() => { setModalItem(it); setTargetFactureId(f.id); setModalOpen(true); }}
                                className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50" title="Modifier"><Pencil size={14} /></button>
                              <button onClick={() => deleteItem(f.id, it.id)}
                                className="p-1.5 rounded-lg text-red-400 hover:bg-red-50" title="Supprimer"><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 mt-4">
        « Vendu » = pièces sorties (Expédié, Reçu livreur, Livré, Échange). Le « Reste » (global et par taille)
        se décrémente automatiquement à chaque commande sortie correspondante (modèle + couleur + taille).
        Une facture reste ouverte tant que vous n'appuyez pas sur « Clôturer » ; l'article suivant en crée alors une nouvelle.
      </p>

      {modalOpen && (
        <ItemModal
          item={modalItem}
          onClose={() => { setModalOpen(false); setModalItem(null); setTargetFactureId(null); }}
          onSave={saveItem}
        />
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
