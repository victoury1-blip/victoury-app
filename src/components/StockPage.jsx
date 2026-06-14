import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Plus, Upload, RefreshCw, Filter, Pencil, Trash2,
  ChevronDown, ChevronUp, Check, ImageIcon, X,
} from 'lucide-react';
import { loadProducts, saveProducts, loadProductsRemote, getTotalStock, SIZE_OPTIONS, NUMERIC_SIZES } from '../data/products';
import { importProductsFromWooCommerce } from '../lib/woocommerce';

/* ─── helpers ─── */
function stockColor(n) {
  if (n === 0) return 'bg-red-500 text-white';
  if (n <= 3)  return 'bg-yellow-400 text-white';
  return 'bg-green-500 text-white';
}

/* ─── Add / Edit product modal ─── */
function ProductModal({ initial, onClose, onSave }) {
  const isNew = !initial;
  const fileRef = useRef(null);

  const emptyVar = (t) => ({ taille: t, stock: 0, prix: 0, compareAt: 0, ajust: 0 });

  const [form, setForm] = useState(() => initial ? { ...initial, variations: initial.variations.map(v => ({ ...v })) } : {
    id: Date.now(),
    ref: '',
    name: '',
    image: null,
    statut: 'Active',
    boutique: 'Manuel',
    shopifyId: '',
    prix: '',
    compareAt: '',
    etiquette: '',
    sizeType: 'alpha',         /* alpha | numeric */
    variations: SIZE_OPTIONS.map(emptyVar),
  });

  function u(k, v) { setForm(p => ({ ...p, [k]: v })); }

  function handleImage(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => u('image', ev.target.result);
    reader.readAsDataURL(file);
  }

  function changeSizeType(type) {
    const sizes = type === 'alpha' ? SIZE_OPTIONS : NUMERIC_SIZES;
    u('sizeType', type);
    setForm(p => ({ ...p, sizeType: type, variations: sizes.map(t => {
      const ex = p.variations.find(v => v.taille === t);
      return ex || emptyVar(t);
    }) }));
  }

  function updateVar(idx, key, val) {
    setForm(p => {
      const vars = [...p.variations];
      vars[idx] = { ...vars[idx], [key]: val };
      return { ...p, variations: vars };
    });
  }

  function addVariation() {
    setForm(p => ({ ...p, variations: [...p.variations, emptyVar('?')] }));
  }

  const ic = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300';
  const lc = 'block text-xs font-semibold text-gray-600 mb-1';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-gray-800 text-lg">{isNew ? 'Ajouter un produit' : 'Modifier le produit'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={16} className="text-gray-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Image */}
          <div>
            <label className={lc}>Image du produit</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="w-full h-40 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors relative overflow-hidden"
            >
              {form.image ? (
                <img src={form.image} alt="preview" className="w-full h-full object-cover" />
              ) : (
                <>
                  <ImageIcon size={32} className="text-gray-300 mb-2" />
                  <p className="text-sm text-gray-400">Cliquer pour ajouter une image</p>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
          </div>

          {/* Name + Ref */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lc}>Nom du produit <span className="text-red-500">*</span></label>
              <input value={form.name} onChange={e => u('name', e.target.value)} className={ic} placeholder="ex: ENSEMBLE SPORTE REFF 1" />
            </div>
            <div>
              <label className={lc}>Référence</label>
              <input value={form.ref} onChange={e => u('ref', e.target.value)} className={ic} placeholder="ex: ENS-001" />
            </div>
          </div>

          {/* Statut / Boutique / ShopifyId */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={lc}>Statut</label>
              <select value={form.statut} onChange={e => u('statut', e.target.value)} className={ic}>
                <option>Active</option><option>Archived</option><option>Draft</option>
              </select>
            </div>
            <div>
              <label className={lc}>Boutique</label>
              <select value={form.boutique} onChange={e => u('boutique', e.target.value)} className={ic}>
                <option>Manuel</option><option>Shopify</option><option>WooCommerce</option>
              </select>
            </div>
            <div>
              <label className={lc}>ID Shopify</label>
              <input value={form.shopifyId} onChange={e => u('shopifyId', e.target.value)} className={ic} placeholder="..." />
            </div>
          </div>

          {/* Prix */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lc}>Prix (MAD)</label>
              <input type="number" value={form.prix} onChange={e => u('prix', e.target.value)} className={ic} />
            </div>
            <div>
              <label className={lc}>Compare-At Prix (MAD)</label>
              <input type="number" value={form.compareAt} onChange={e => u('compareAt', e.target.value)} className={ic} />
            </div>
          </div>

          {/* Size type toggle */}
          <div>
            <label className={lc}>Type de tailles</label>
            <div className="flex gap-2">
              {['alpha', 'numeric'].map(t => (
                <button key={t} onClick={() => changeSizeType(t)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${form.sizeType === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                  {t === 'alpha' ? 'S/M/L/XL…' : '36/37/38…'}
                </button>
              ))}
            </div>
          </div>

          {/* Variations */}
          <div>
            <label className={lc}>Variations ({form.variations.length})</label>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Taille', 'Stock', 'Prix (MAD)', 'Compare-At'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {form.variations.map((v, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">
                        <input value={v.taille} onChange={e => updateVar(i, 'taille', e.target.value)}
                          className="border border-gray-200 rounded px-2 py-1 text-xs w-16 text-center font-bold" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" value={v.stock} onChange={e => updateVar(i, 'stock', parseInt(e.target.value) || 0)}
                          className="border border-gray-200 rounded px-2 py-1 text-xs w-20" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" value={v.prix} onChange={e => updateVar(i, 'prix', parseFloat(e.target.value) || 0)}
                          className="border border-gray-200 rounded px-2 py-1 text-xs w-24" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" value={v.compareAt} onChange={e => updateVar(i, 'compareAt', parseFloat(e.target.value) || 0)}
                          className="border border-gray-200 rounded px-2 py-1 text-xs w-24" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={addVariation}
                className="w-full py-2 text-sm text-blue-600 hover:bg-blue-50 flex items-center justify-center gap-1">
                <Plus size={13} /> Ajouter une variation
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
          <button
            onClick={() => { if (!form.name.trim()) return; onSave(form); onClose(); }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700"
          >
            {isNew ? 'Ajouter le produit' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main StockPage ─── */
export default function StockPage() {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [addOpen, setAddOpen] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);

  async function handleSynchroniser() {
    setSyncing(true);
    setSyncStatus({ type: 'syncing', message: 'Connexion à WooCommerce...' });
    const result = await importProductsFromWooCommerce((msg) => {
      setSyncStatus({ type: 'syncing', message: msg });
    });
    setSyncing(false);
    if (!result.success) {
      setSyncStatus({ type: 'error', message: `Erreur: ${result.error}` });
      setTimeout(() => setSyncStatus(null), 4000);
      return;
    }
    setProducts(prev => {
      const updated = [...prev];
      let added = 0, updated_count = 0;
      for (const wp of result.products) {
        const idx = updated.findIndex(p => p.wooId === wp.wooId);
        if (idx >= 0) {
          updated[idx] = { ...updated[idx], name: wp.name, ref: wp.ref, prix: wp.prix, compareAt: wp.compareAt, statut: wp.statut, image: wp.image || updated[idx].image, variations: wp.variations };
          updated_count++;
        } else {
          updated.unshift(wp);
          added++;
        }
      }
      saveProducts(updated);
      setSyncStatus({ type: 'success', message: `✓ ${added} produit(s) ajouté(s), ${updated_count} mis à jour` });
      setTimeout(() => setSyncStatus(null), 3000);
      return updated;
    });
  }

  useEffect(() => {
    loadProductsRemote().then(remote => {
      setProducts(remote || loadProducts());
      setLoadingProducts(false);
    });
  }, []);
  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [filterBoutique, setFilterBoutique] = useState('');

  function persist(p) { setProducts(p); saveProducts(p); }

  function toggleExpand(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function handleAdjust(prodId, varIdx, delta) {
    persist(products.map(p => {
      if (p.id !== prodId) return p;
      const vars = p.variations.map((v, i) => i === varIdx ? { ...v, ajust: (v.ajust || 0) + delta } : v);
      return { ...p, variations: vars };
    }));
  }

  function applyAdjust(prodId, varIdx) {
    persist(products.map(p => {
      if (p.id !== prodId) return p;
      const vars = p.variations.map((v, i) => i === varIdx ? { ...v, stock: Math.max(0, (v.stock || 0) + (v.ajust || 0)), ajust: 0 } : v);
      return { ...p, variations: vars };
    }));
  }

  function handleDelete(id) {
    if (!window.confirm('Supprimer ce produit ?')) return;
    persist(products.filter(p => p.id !== id));
  }

  function handleSave(form) {
    if (editProduct) {
      persist(products.map(p => p.id === form.id ? form : p));
    } else {
      persist([form, ...products]);
    }
    setEditProduct(null);
  }

  const filtered = useMemo(() => products.filter(p => {
    const q = search.toLowerCase();
    const matchQ = !q || p.name.toLowerCase().includes(q) || (p.ref || '').toLowerCase().includes(q);
    const matchS = !filterStatut || p.statut === filterStatut;
    const matchB = !filterBoutique || p.boutique === filterBoutique;
    return matchQ && matchS && matchB;
  }), [products, search, filterStatut, filterBoutique]);

  const totalStock = products.reduce((s, p) => s + getTotalStock(p), 0);

  const selCls = 'border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white';

  if (loadingProducts) {
    return <div className="flex items-center justify-center h-64 gap-2 text-gray-400"><RefreshCw size={18} className="animate-spin" /><span>Chargement...</span></div>;
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Sync Status Notification */}
      {syncStatus && (
        <div className={`px-6 py-3 text-sm font-medium flex items-center gap-2 ${
          syncStatus.type === 'success' ? 'bg-green-100 text-green-800' :
          syncStatus.type === 'error' ? 'bg-red-100 text-red-800' :
          'bg-blue-100 text-blue-800'
        }`}>
          {syncStatus.type === 'syncing' && <RefreshCw size={16} className="animate-spin" />}
          {syncStatus.type === 'success' && <Check size={16} />}
          {syncStatus.type === 'error' && <X size={16} />}
          {syncStatus.message}
        </div>
      )}
      
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex flex-wrap items-center gap-2">
        <button onClick={() => { setEditProduct(null); setAddOpen(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700">
          <Plus size={14} /> Ajouter
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800">
          <Upload size={14} /> Ajouter Stock
        </button>
        <button
          onClick={handleSynchroniser}
          disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 disabled:opacity-60">
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> Synchroniser
        </button>

        <div className="flex items-center gap-2 ml-2">
          <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} className={selCls}>
            <option value="">Tous les statuts</option>
            <option>Active</option><option>Archived</option><option>Draft</option>
          </select>
          <select value={filterBoutique} onChange={e => setFilterBoutique(e.target.value)} className={selCls}>
            <option value="">Toutes les boutiques</option>
            <option>Manuel</option><option>Shopify</option><option>WooCommerce</option>
          </select>
          <button className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">
            <Filter size={13} /> Filtrer
          </button>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un produit..."
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        <div className="ml-auto flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 text-sm font-semibold text-blue-700">
          <span>📦</span> Total Stock: {totalStock} unité(s)
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <tr>
              {['IMAGE', 'PRODUIT', 'STOCK #', 'AJUSTER', 'STATUT', 'BOUTIQUE', 'ID SHOPIFY', 'PRIX', 'COMPARE-AT', 'ÉTIQUETTE', 'ACTIONS'].map(h => (
                <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={11} className="py-16 text-center text-gray-400">Aucun produit trouvé</td></tr>
            )}
            {filtered.map(p => {
              const total = getTotalStock(p);
              const isOpen = expanded[p.id];
              return (
                <React.Fragment key={p.id}>
                  {/* Product row */}
                  <tr className="bg-white border-b border-gray-100 hover:bg-gray-50">
                    {/* Image */}
                    <td className="px-3 py-3">
                      <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center">
                        {p.image
                          ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                          : <ImageIcon size={20} className="text-gray-300" />}
                      </div>
                    </td>

                    {/* Produit */}
                    <td className="px-3 py-3">
                      <div className="font-semibold text-gray-800">{p.name}</div>
                      {p.ref && <div className="text-xs text-gray-400">Réf: {p.ref}</div>}
                      <button
                        onClick={() => toggleExpand(p.id)}
                        className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full hover:bg-blue-100"
                      >
                        📋 {p.variations.length} variations
                        {isOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                      </button>
                    </td>

                    {/* Stock total */}
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold ${stockColor(total)}`}>
                        {total}
                      </span>
                      <div className="text-xs text-gray-400 mt-0.5">{p.variations.length} var.</div>
                    </td>

                    {/* Ajuster (global — no-op, expand to adjust per variation) */}
                    <td className="px-3 py-3">
                      <span className="text-xs text-gray-400 italic">Par variation</span>
                    </td>

                    {/* Statut */}
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${p.statut === 'Active' ? 'bg-green-100 text-green-700' : p.statut === 'Archived' ? 'bg-gray-100 text-gray-600' : 'bg-yellow-100 text-yellow-700'}`}>
                        {p.statut}
                      </span>
                    </td>

                    {/* Boutique */}
                    <td className="px-3 py-3 font-semibold text-gray-700">{p.boutique}</td>

                    {/* Shopify ID */}
                    <td className="px-3 py-3 text-xs text-gray-400 font-mono">{p.shopifyId || '—'}</td>

                    {/* Prix */}
                    <td className="px-3 py-3 font-bold text-gray-800">{p.prix ? `${p.prix} MAD` : '—'}</td>

                    {/* Compare-At */}
                    <td className="px-3 py-3 text-gray-400">{p.compareAt ? `${p.compareAt} MAD` : '—'}</td>

                    {/* Étiquette */}
                    <td className="px-3 py-3">
                      <span className="text-xs text-gray-400">{p.etiquette || '—'}</span>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => toggleExpand(p.id)}
                          className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 whitespace-nowrap">
                          Voir variations
                        </button>
                        <button onClick={() => { setEditProduct(p); setAddOpen(true); }}
                          className="p-1.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200"><Pencil size={13} /></button>
                        <button onClick={() => handleDelete(p.id)}
                          className="p-1.5 rounded bg-red-100 text-red-500 hover:bg-red-200"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded variations */}
                  {isOpen && (
                    <tr className="bg-blue-50/40">
                      <td colSpan={11} className="px-6 py-4">
                        <div className="text-xs font-semibold text-gray-500 uppercase mb-2">VARIATIONS DU PRODUIT</div>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs font-semibold text-gray-500 uppercase">
                              {['ATTRIBUTS', 'STOCK', 'AJUSTER', 'PRIX', 'COMPARE-AT PRICE', 'ÉTIQUETTE'].map(h => (
                                <th key={h} className="px-3 py-2 text-left">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-blue-100">
                            {p.variations.map((v, i) => (
                              <tr key={i} className="hover:bg-blue-50">
                                <td className="px-3 py-2">
                                  <span className="inline-flex items-center px-2 py-0.5 bg-gray-200 text-gray-800 rounded text-xs font-bold">
                                    Taille: {v.taille}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${stockColor(v.stock)}`}>
                                    {v.stock}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => handleAdjust(p.id, i, -1)}
                                      className="w-6 h-6 flex items-center justify-center border border-gray-300 rounded text-gray-600 hover:bg-gray-100 font-bold text-base leading-none">−</button>
                                    <span className="w-8 text-center font-semibold text-sm">{v.ajust || 0}</span>
                                    <button onClick={() => handleAdjust(p.id, i, 1)}
                                      className="w-6 h-6 flex items-center justify-center border border-gray-300 rounded text-gray-600 hover:bg-gray-100 font-bold text-base leading-none">+</button>
                                    <button onClick={() => applyAdjust(p.id, i)}
                                      className="w-6 h-6 flex items-center justify-center bg-green-500 text-white rounded hover:bg-green-600">
                                      <Check size={11} />
                                    </button>
                                  </div>
                                </td>
                                <td className="px-3 py-2 font-medium">{v.prix} MAD</td>
                                <td className="px-3 py-2 text-gray-400">{v.compareAt} MAD</td>
                                <td className="px-3 py-2 text-gray-400 text-xs">—</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {addOpen && (
        <ProductModal
          initial={editProduct}
          onClose={() => { setAddOpen(false); setEditProduct(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
