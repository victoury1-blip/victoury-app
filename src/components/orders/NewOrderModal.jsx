import React, { useState, useEffect } from 'react';
import { X, Plus, Check } from 'lucide-react';
import { useStatuses } from '../../contexts/StatusContext';
import { loadProducts, loadProductsRemote } from '../../data/products';
import { now } from '../../lib/dateUtils';
import { generateVictId } from '../../lib/victId';

export default function NewOrderModal({ onClose, onSave }) {
  const ic = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 bg-white transition';
  const lc = 'block text-xs font-medium text-gray-500 mb-1.5';
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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] sm:max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0 bg-gray-900 rounded-t-2xl">
          <div>
            <h3 className="font-bold text-white">Nouvelle commande</h3>
            <p className="text-xs text-gray-300 mt-0.5">ID : auto-généré</p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="p-2 rounded-full hover:bg-gray-700 text-gray-300 transition"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          <div>
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
              <span>📋</span><span className="text-sm font-bold text-gray-900 uppercase tracking-wide">Client</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lc}>Nom client <span className="text-red-400">*</span></label><input value={form.nom} onChange={(e) => u('nom', e.target.value)} className={ic} placeholder="Nom complet" /></div>
              <div><label className={lc}>📞 Téléphone <span className="text-red-400">*</span></label><input value={form.telephone} onChange={(e) => u('telephone', e.target.value)} className={ic} placeholder="+212..." /></div>
              <div><label className={lc}>🏙 Ville</label><input value={form.ville} onChange={(e) => u('ville', e.target.value)} className={ic} placeholder="Ville" /></div>
              <div><label className={lc}>📍 Adresse</label><input value={form.adresse} onChange={(e) => u('adresse', e.target.value)} className={ic} placeholder="Adresse" /></div>
              <div className="col-span-2"><label className={lc}>🚚 Livreur</label>
                <select value={form.livreur} onChange={(e) => u('livreur', e.target.value)} className={ic}>
                  {livreurOptions.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
              <span>🛍</span><span className="text-sm font-bold text-gray-900 uppercase tracking-wide">Produits</span>
            </div>
            <div className="space-y-2">
              {form.products.map((prod, idx) => {
                const selProd = stockProducts.find(p => p.name === prod.name);
                const sizes = selProd ? selProd.variations.map(v => v.taille) : [];
                return (
                  <div key={idx} className="flex flex-col gap-1.5 bg-gray-50 rounded-lg p-2 border border-gray-100">
                    <div className="flex items-center gap-2">
                      <select value={prod.name} onChange={(e) => updateProduct(idx, 'name', e.target.value)}
                        className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white">
                        <option value="">-- Produit --</option>
                        {stockProducts.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                      </select>
                      <button onClick={() => removeProduct(idx)}
                        className="p-2 rounded-lg bg-red-500 text-white hover:bg-red-600 shrink-0 transition">
                        <X size={12} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={prod.size || ''} onChange={(e) => updateProduct(idx, 'size', e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white w-16 shrink-0">
                        <option value="">T.</option>
                        {sizes.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <input type="number" min={1} value={prod.qty} onChange={(e) => updateProduct(idx, 'qty', Number(e.target.value))}
                        className="border border-gray-200 rounded-lg px-2 py-2 text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white w-12 shrink-0" />
                    </div>
                  </div>
                );
              })}
              <button onClick={addProduct}
                className="w-full border-2 border-dashed border-gray-200 rounded-lg py-2.5 text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 flex items-center justify-center gap-1.5 transition-colors">
                <Plus size={14} /> Ajouter un produit
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
              <span>💰</span><span className="text-sm font-bold text-gray-900 uppercase tracking-wide">Paiement</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lc}>💵 Prix total (DH) <span className="text-red-400">*</span></label>
                <input type="number" value={form.prix} onChange={(e) => u('prix', e.target.value)} className={ic} placeholder="0.00" /></div>
              <div><label className={lc}>Nombre de commandes</label>
                <input type="number" min={1} max={500} value={form.qty} onChange={(e) => u('qty', Math.max(1, Number(e.target.value)))} className={ic} /></div>
            </div>
            <div className="mt-4">
              <label className={lc}>Statut</label>
              <select value={form.status} onChange={(e) => u('status', e.target.value)} className={ic}>
                {statuses.filter(s => s.showInCommandes !== false).map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/80 rounded-b-2xl shrink-0 pb-[env(safe-area-inset-bottom,16px)]">
          <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition">Annuler</button>
          <button onClick={handleSave} disabled={!form.nom || !form.telephone || !form.prix}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2">
            <Check size={14} />
            {form.qty > 1 ? `Créer ${form.qty} commandes` : 'Créer la commande'}
          </button>
        </div>
      </div>
    </div>
  );
}
