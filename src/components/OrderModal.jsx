import React, { useState } from 'react';
import { X, Check, Phone, MapPin, Plus, Trash2 } from 'lucide-react';
import { useStatuses } from '../contexts/StatusContext';
import { loadProducts, SIZE_OPTIONS, NUMERIC_SIZES } from '../data/products';

const LIVREURS = [
  { value: '', label: 'Sélectionner un livreur' },
  { value: 'ozone_express', label: 'Ozone Express' },
  { value: 'mohamed_younesse', label: 'Mohamed et Younesse' },
  { value: 'local', label: 'Local' },
  { value: 'blackmandelivery', label: 'blackmandelivery' },
];

function SectionTitle({ icon, label }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-gray-400">{icon}</span>
      <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{label}</span>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-blue-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white';

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
    const updated = {
      ...form,
      product: form.products[0] || form.product,
      note: form.noteInterne,
    };
    onSave(updated);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Modifier la commande {order.id}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Mettre à jour les informations</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* INFORMATIONS PRINCIPALES */}
          <div>
            <SectionTitle icon="📋" label="Informations principales" />
            <div className="grid grid-cols-2 gap-3">
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

              <Field label="Nom du client">
                <input
                  value={form.recipient.name}
                  onChange={(e) => updateRecipient('name', e.target.value)}
                  className={inputCls}
                  placeholder="Nom complet"
                />
              </Field>

              <Field label="Téléphone">
                <div className="relative">
                  <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={form.recipient.phone}
                    onChange={(e) => updateRecipient('phone', e.target.value)}
                    className={`${inputCls} pl-8`}
                    placeholder="+212..."
                  />
                </div>
              </Field>

              <Field label="Adresse">
                <div className="relative">
                  <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={form.recipient.address}
                    onChange={(e) => updateRecipient('address', e.target.value)}
                    className={`${inputCls} pl-8`}
                    placeholder="Adresse complète"
                  />
                </div>
              </Field>

              <Field label="Livreur">
                <select
                  value={form.recipient.delivery || ''}
                  onChange={(e) => updateRecipient('delivery', e.target.value)}
                  className={inputCls}
                >
                  {LIVREURS.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Ville">
                <input
                  value={form.recipient.city}
                  onChange={(e) => updateRecipient('city', e.target.value)}
                  className={inputCls}
                  placeholder="Ville"
                />
              </Field>
            </div>
          </div>

          {/* PRODUITS */}
          <div>
            <SectionTitle icon="📦" label="Produits" />
            <div className="space-y-2">
              {form.products.map((prod, idx) => {
                const stockProducts = loadProducts();
                const selProd = stockProducts.find(p => p.name === prod.name);
                const sizes = selProd
                  ? selProd.variations.map(v => v.taille)
                  : (prod.size && isNaN(prod.size) ? SIZE_OPTIONS : NUMERIC_SIZES);
                return (
                  <div key={idx} className="flex items-center gap-1.5">
                    <select
                      value={prod.name}
                      onChange={(e) => { updateProduct(idx, 'name', e.target.value); updateProduct(idx, 'size', ''); }}
                      className={`${inputCls} flex-1 min-w-0`}
                    >
                      <option value="">-- Choisir un produit --</option>
                      {stockProducts.map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                    <select
                      value={prod.size || ''}
                      onChange={(e) => updateProduct(idx, 'size', e.target.value)}
                      className="border border-gray-200 rounded-md px-1.5 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white w-16 shrink-0"
                    >
                      <option value="">T.</option>
                      {sizes.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <input
                      type="number" min={1} value={prod.qty}
                      onChange={(e) => updateProduct(idx, 'qty', Number(e.target.value))}
                      className="border border-gray-200 rounded-md px-1 py-2 text-xs text-center text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white w-12 shrink-0"
                    />
                    <button onClick={() => removeProduct(idx)}
                      className="p-1.5 rounded-md bg-red-500 text-white hover:bg-red-600 shrink-0">
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
              <button
                onClick={addProduct}
                className="w-full border-2 border-dashed border-gray-300 rounded-md py-2 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 flex items-center justify-center gap-1.5 transition-colors mt-1"
              >
                <Plus size={14} /> Ajouter un produit
              </button>
            </div>
          </div>

          {/* PAIEMENT & OPTIONS */}
          <div>
            <SectionTitle icon="💳" label="Paiement & Options" />
            <div className="grid grid-cols-2 gap-3 items-end">
              <Field label="Prix total">
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => update('price', Number(e.target.value))}
                  className={inputCls}
                  placeholder="0.00"
                />
              </Field>
              <Field label="Échange">
                <button
                  onClick={() => update('echange', !form.echange)}
                  className={`w-full py-2 rounded-md text-sm font-bold transition-colors ${
                    form.echange
                      ? 'bg-green-500 text-white'
                      : 'bg-red-500 text-white'
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
            <div className="space-y-3">
              <Field label="Note interne">
                <textarea
                  value={form.noteInterne}
                  onChange={(e) => update('noteInterne', e.target.value)}
                  rows={3}
                  className={`${inputCls} resize-none`}
                  placeholder="Note interne..."
                />
              </Field>
              <Field label="Note Livraison">
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

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <Check size={14} />
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
