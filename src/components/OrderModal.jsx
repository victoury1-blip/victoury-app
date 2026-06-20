import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, Check, Plus, Trash2 } from 'lucide-react';
import { useStatuses } from '../contexts/StatusContext';
import { loadProducts, SIZE_OPTIONS, NUMERIC_SIZES } from '../data/products';

function getCitiesForLivreur(livreurName) {
  try {
    const livreurs = JSON.parse(localStorage.getItem('livreurs') || '[]');
    const liv = livreurs.find(l => l.nom === livreurName);
    if (!liv) return [];
    const frais = JSON.parse(localStorage.getItem(`frais_${liv.id}`) || '[]');
    return frais.map(f => f.ville).filter(Boolean).sort();
  } catch { return []; }
}

function getLivreurs() {
  try {
    const stored = JSON.parse(localStorage.getItem('livreurs') || '[]');
    if (Array.isArray(stored) && stored.length > 0) {
      return [{ value: '', label: 'Sélectionner un livreur' },
        ...stored.filter(l => l.statut !== false).map(l => ({ value: l.nom, label: l.nom }))];
    }
  } catch {}
  return [
    { value: '', label: 'Sélectionner un livreur' },
    { value: 'Ozon Express', label: 'Ozon Express' },
    { value: 'Mohamed et Younesse', label: 'Mohamed et Younesse' },
    { value: 'Local', label: 'Local' },
    { value: 'blackmandelivery', label: 'blackmandelivery' },
  ];
}

function SectionTitle({ icon, label }) {
  return (
    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
      <span>{icon}</span>
      <span className="text-sm font-bold text-gray-900 uppercase tracking-wide">{label}</span>
    </div>
  );
}

function Field({ label, icon, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">
        {icon && <span className="mr-1">{icon}</span>}{label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 bg-white transition';

function CityAutocomplete({ value, onChange, livreur }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const ref = useRef(null);
  const cities = useMemo(() => getCitiesForLivreur(livreur), [livreur]);

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = cities.filter(c => {
    const q = (filter || value || '').toLowerCase();
    return !q || c.toLowerCase().includes(q);
  });

  return (
    <div className="relative" ref={ref}>
      <input
        value={value || ''}
        onChange={(e) => { onChange(e.target.value); setFilter(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className={inputCls}
        placeholder="Ville"
      />
      {open && cities.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.length === 0 && <div className="px-3 py-2 text-xs text-gray-400">Aucune ville trouvée</div>}
          {filtered.slice(0, 50).map(c => (
            <button
              key={c}
              type="button"
              onClick={() => { onChange(c); setOpen(false); setFilter(''); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${c.toLowerCase() === (value || '').toLowerCase() ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'}`}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrderModal({ order, onClose, onSave }) {
  const { statuses } = useStatuses();
  const [form, setForm] = useState({
    ...order,
    recipient: { ...order.recipient },
    products: order.products || [
      { name: order.product.name, size: order.product.size, qty: order.product.qty },
    ],
    noteInterne: order.note || '',
    noteLivraison: order.noteLivraison || '',
    echange: order.echange || false,
  });

  function update(field, value) {
    setForm((p) => ({ ...p, [field]: value }));
  }
  function updateRecipient(field, value) {
    setForm((p) => ({ ...p, recipient: { ...p.recipient, [field]: value } }));
  }
  function updateProduct(idx, field, value) {
    setForm((p) => {
      const products = [...p.products];
      products[idx] = { ...products[idx], [field]: value };
      return { ...p, products };
    });
  }
  function addProduct() {
    setForm((p) => ({ ...p, products: [...p.products, { name: '', size: '', qty: 1 }] }));
  }
  function removeProduct(idx) {
    setForm((p) => ({ ...p, products: p.products.filter((_, i) => i !== idx) }));
  }

  function handleSave() {
    try {
      const updated = {
        ...form,
        product: form.products[0] || form.product,
        note: form.noteInterne,
      };
      onSave(updated);
    } catch (err) {
      console.error('Save failed:', err);
      alert('Erreur: ' + err.message);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] sm:max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Modifier la commande #{order.id}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Mettez à jour les informations</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-400 transition">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* INFORMATIONS PRINCIPALES */}
          <div>
            <SectionTitle icon="📋" label="Informations principales" />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Statut">
                <select
                  value={form.status}
                  onChange={(e) => update('status', e.target.value)}
                  className={inputCls}
                >
                  {[{ value: '', label: 'Choisir un statut' }, ...statuses.filter(s => s.showInCommandes !== false)].map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Nom du client">
                <input
                  value={form.recipient.name}
                  onChange={(e) => updateRecipient('name', e.target.value)}
                  className={inputCls}
                  placeholder="Nom complet"
                />
              </Field>

              {form.status === 'reporter' && (
                <Field label="Date de report">
                  <input
                    type="date"
                    value={form.reportDate || ''}
                    onChange={(e) => update('reportDate', e.target.value)}
                    className={inputCls}
                  />
                </Field>
              )}

              <Field label="Téléphone" icon="📞">
                <input
                  value={form.recipient.phone}
                  onChange={(e) => updateRecipient('phone', e.target.value)}
                  className={inputCls}
                  placeholder="+212..."
                />
              </Field>

              <Field label="Adresse" icon="📍">
                <input
                  value={form.recipient.address}
                  onChange={(e) => updateRecipient('address', e.target.value)}
                  className={inputCls}
                  placeholder="Adresse"
                />
              </Field>

              <Field label="Livreur" icon="🚚">
                <select
                  value={form.recipient.delivery || ''}
                  onChange={(e) => updateRecipient('delivery', e.target.value)}
                  className={inputCls}
                >
                  {getLivreurs().map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Ville" icon="🏙">
                <CityAutocomplete
                  value={form.recipient.city}
                  onChange={(v) => updateRecipient('city', v)}
                  livreur={form.recipient.delivery}
                />
              </Field>
            </div>
          </div>

          {/* PRODUITS */}
          <div>
            <SectionTitle icon="🛍" label="Produits" />
            <div className="space-y-2">
              {form.products.map((prod, idx) => {
                const stockProducts = loadProducts();
                const selProd = stockProducts.find(p => p.name === prod.name);
                const sizes = selProd
                  ? selProd.variations.map(v => v.taille)
                  : (prod.size && isNaN(prod.size) ? SIZE_OPTIONS : NUMERIC_SIZES);
                const sizeOptions = sizes.includes(prod.size || '') || !prod.size ? sizes : [prod.size, ...sizes];
                return (
                  <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2 border border-gray-100">
                    <select
                      value={prod.name}
                      onChange={(e) => { updateProduct(idx, 'name', e.target.value); updateProduct(idx, 'size', ''); }}
                      className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2.5 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                    >
                      <option value="">-- Choisir un produit --</option>
                      {prod.name && !stockProducts.find(p => p.name === prod.name) && (
                        <option value={prod.name}>{prod.name}</option>
                      )}
                      {stockProducts.map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                    <select
                      value={prod.size || ''}
                      onChange={(e) => updateProduct(idx, 'size', e.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white w-20 shrink-0"
                    >
                      <option value="">Taille</option>
                      {sizeOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <input
                      type="number" min={1} value={prod.qty}
                      onChange={(e) => updateProduct(idx, 'qty', Number(e.target.value))}
                      className="border border-gray-200 rounded-lg px-2 py-2 text-sm text-center text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white w-12 shrink-0"
                    />
                    <button onClick={() => removeProduct(idx)}
                      className="p-2 rounded-lg bg-red-500 text-white hover:bg-red-600 shrink-0 transition">
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
              <button
                onClick={addProduct}
                className="w-full border-2 border-dashed border-gray-200 rounded-lg py-2.5 text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus size={14} /> Ajouter un produit
              </button>
            </div>
          </div>

          {/* PAIEMENT & OPTIONS */}
          <div>
            <SectionTitle icon="💰" label="Paiement & Options" />
            <div className="grid grid-cols-2 gap-4 items-end">
              <Field label="Prix total" icon="💵">
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => update('price', Number(e.target.value))}
                  className={inputCls}
                  placeholder="0.00"
                />
              </Field>
              <Field label="Échange" icon="🔄">
                <button
                  onClick={() => update('echange', !form.echange)}
                  className={`w-full py-2.5 rounded-lg text-sm font-bold transition-colors ${
                    form.echange
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : 'bg-red-500 text-white hover:bg-red-600'
                  }`}
                >
                  {form.echange ? 'OUI' : 'NON'}
                </button>
              </Field>
            </div>
          </div>

          {/* NOTES */}
          <div>
            <SectionTitle icon="📝" label="Notes" />
            <div className="space-y-4">
              <Field label="Note interne" icon="🔒">
                <textarea
                  value={form.noteInterne}
                  onChange={(e) => update('noteInterne', e.target.value)}
                  rows={3}
                  className={`${inputCls} resize-none`}
                  placeholder="Note interne..."
                />
              </Field>
              <Field label="Note Livraison" icon="🚛">
                <textarea
                  value={form.noteLivraison}
                  onChange={(e) => update('noteLivraison', e.target.value)}
                  rows={3}
                  className={`${inputCls} resize-none`}
                  placeholder="Note pour le livreur..."
                />
              </Field>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/80 rounded-b-2xl shrink-0 pb-[env(safe-area-inset-bottom,16px)]">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Check size={14} />
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
