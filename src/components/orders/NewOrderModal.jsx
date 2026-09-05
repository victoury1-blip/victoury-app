import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Plus, Check, Trash2 } from 'lucide-react';
import { useStatuses } from '../../contexts/StatusContext';
import { loadProducts, loadProductsRemote, SIZE_OPTIONS, NUMERIC_SIZES } from '../../data/products';
import { orderableProducts } from '../../lib/orderProducts';
import { now } from '../../lib/dateUtils';
import { generateVictId } from '../../lib/victId';

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 bg-white transition';

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
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{icon && <span className="mr-1">{icon}</span>}{label}</label>
      {children}
    </div>
  );
}
function getLivreurs() {
  try {
    const stored = JSON.parse(localStorage.getItem('livreurs') || '[]');
    if (Array.isArray(stored) && stored.length > 0)
      return [{ value: '', label: 'Sélectionner un livreur' }, ...stored.filter(l => l.statut !== false).map(l => ({ value: l.nom, label: l.nom }))];
  } catch {}
  return [{ value: '', label: 'Sélectionner un livreur' }];
}
function getCitiesForLivreur(livreurName) {
  try {
    const livreurs = JSON.parse(localStorage.getItem('livreurs') || '[]');
    const liv = livreurs.find(l => l.nom === livreurName);
    if (!liv) return [];
    const frais = JSON.parse(localStorage.getItem(`frais_${liv.id}`) || '[]');
    return frais.map(f => f.ville).filter(Boolean).sort();
  } catch { return []; }
}
function CityAutocomplete({ value, onChange, livreur }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const ref = useRef(null);
  const cities = useMemo(() => getCitiesForLivreur(livreur), [livreur]);
  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const filtered = cities.filter(c => { const q = (filter || value || '').toLowerCase(); return !q || c.toLowerCase().includes(q); });
  return (
    <div className="relative" ref={ref}>
      <input value={value || ''} onChange={(e) => { onChange(e.target.value); setFilter(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} className={inputCls} placeholder="Ville" />
      {open && cities.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.length === 0 && <div className="px-3 py-2 text-xs text-gray-400">Aucune ville trouvée</div>}
          {filtered.slice(0, 50).map(c => (
            <button key={c} type="button" onClick={() => { onChange(c); setOpen(false); setFilter(''); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${c.toLowerCase() === (value || '').toLowerCase() ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'}`}>
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NewOrderModal({ onClose, onSave, orders = [] }) {
  // Seulement les siens : les articles d'affiliation sont remplis par leur
  // plateforme, jamais choisis à la main ici.
  const [stockProducts, setStockProducts] = useState(() => orderableProducts(loadProducts()));
  useEffect(() => {
    loadProductsRemote().then(remote => {
      if (remote && remote.length > 0) {
        // Le Stock, lui, garde tout le catalogue : c'est ce qu'il faut au réassort.
        localStorage.setItem('victoury_products', JSON.stringify(remote));
        setStockProducts(orderableProducts(remote));
      }
    });
  }, []);
  const { statuses } = useStatuses();
  const [form, setForm] = useState({
    nom: '', telephone: '', ville: '', adresse: '', prix: '', livreur: '',
    // La quantité par produit part VIDE, pas de "1" pré-rempli : un "1" par
    // défaut se laisse traverser sans qu'on le regarde, et c'est justement
    // lui qui fausse le coût d'achat dans le Rapport de Profit dès que la
    // vraie quantité est différente. Vide oblige à taper un chiffre.
    products: [{ name: '', size: '', qty: '' }],
    status: 'nouveau', qty: 1, echange: false, noteInterne: '', noteLivraison: '',
  });
  function u(k, v) { setForm((p) => ({ ...p, [k]: v })); }
  function updateProduct(idx, field, value) {
    setForm(p => {
      const products = [...p.products];
      products[idx] = { ...products[idx], [field]: value, ...(field === 'name' ? { size: '' } : {}) };
      return { ...p, products };
    });
  }
  function addProduct() { setForm(p => ({ ...p, products: [...p.products, { name: '', size: '', qty: '' }] })); }
  function removeProduct(idx) { setForm(p => ({ ...p, products: p.products.filter((_, i) => i !== idx) })); }

  // Un livreur choisi = une commande sur le point de partir : c'est le
  // dernier moment sûr pour forcer la vraie quantité de chaque produit,
  // avant qu'elle ne serve (fausse) au calcul du profit.
  // Vérifiée dès qu'un produit est choisi, pas seulement quand un livreur est
  // affecté — une commande "À Confirmer" sans livreur peut tout aussi bien
  // se sauvegarder avec une quantité vide, et rien ne la revalide ensuite :
  // le coût dans Profit serait alors calculé comme 0 pour cette ligne.
  const qtyManquante = form.products.some(p => p.name && !(Number(p.qty) > 0));
  // Somme visible en direct : 1 produit à 1 + un 2ᵉ à 1 → 2, pas besoin de
  // les additionner soi-même pour savoir ce que le Rapport de Profit verra.
  const qteTotale = form.products.reduce((s, p) => s + (Number(p.qty) || 0), 0);

  async function handleSave() {
    if (!form.nom || !form.telephone || !form.prix || qtyManquante) return;
    const count = Math.max(1, Math.min(form.qty || 1, 500));
    const t = now();
    const firstProd = form.products[0] || {};
    const createdOrders = [];
    for (let i = 0; i < count; i++) {
      // Plus petit numéro VICTOURY libre parmi les commandes actives (une
      // commande supprimée libère son numéro pour la prochaine création).
      const id = generateVictId([...orders, ...createdOrders]);
      createdOrders.push({
        id,
        recipient: { name: form.nom, phone: form.telephone, city: form.ville, address: form.adresse, delivery: form.livreur || null },
        product: { name: firstProd.name, size: firstProd.size, qty: firstProd.qty || 1, stock: 0 },
        products: form.products.map(p => ({ ...p })),
        price: parseFloat(form.prix) || 0,
        status: form.status || 'nouveau',
        echange: !!form.echange,
        note: form.noteInterne || '',
        noteLivraison: form.noteLivraison || '',
        dateAdded: t, dateUpdated: t, validated: false,
      });
    }
    onSave(createdOrders);
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] sm:max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0 bg-gray-900 rounded-t-2xl">
          <div>
            <h2 className="text-base font-bold text-white">Nouvelle commande</h2>
            <p className="text-xs text-gray-300 mt-0.5">ID : auto-généré</p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="p-2 rounded-full hover:bg-gray-700 text-gray-300 transition"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* INFORMATIONS PRINCIPALES */}
          <div>
            <SectionTitle icon="📋" label="Informations principales" />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Statut">
                <select value={form.status} onChange={(e) => u('status', e.target.value)} className={inputCls}>
                  {statuses.filter(s => s.showInCommandes !== false).map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Nom du client">
                <input value={form.nom} onChange={(e) => u('nom', e.target.value)} className={inputCls} placeholder="Nom complet" />
              </Field>
              <Field label="Téléphone" icon="📞">
                <input value={form.telephone} onChange={(e) => u('telephone', e.target.value)} className={inputCls} placeholder="+212..." />
              </Field>
              <Field label="Adresse" icon="📍">
                <input value={form.adresse} onChange={(e) => u('adresse', e.target.value)} className={inputCls} placeholder="Adresse" />
              </Field>
              <Field label="Livreur" icon="🚚">
                <select value={form.livreur} onChange={(e) => u('livreur', e.target.value)} className={inputCls}>
                  {getLivreurs().map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </Field>
              <Field label="Ville" icon="🏙">
                <CityAutocomplete value={form.ville} onChange={(v) => u('ville', v)} livreur={form.livreur} />
              </Field>
            </div>
          </div>

          {/* PRODUITS */}
          <div>
            <SectionTitle icon="🛍" label="Produits" />
            <div className="space-y-2">
              {form.products.map((prod, idx) => {
                const selProd = stockProducts.find(p => p.name === prod.name);
                // `variations` peut manquer sur un produit mal formé : sans ce
                // garde-fou, la fenêtre de commande plante et devient inutilisable.
                const sizes = selProd?.variations?.length
                  ? selProd.variations.map(v => v.taille)
                  : (prod.size && !isNaN(prod.size) ? NUMERIC_SIZES : SIZE_OPTIONS);
                const sizeOptions = sizes.includes(prod.size || '') || !prod.size ? sizes : [prod.size, ...sizes];
                return (
                  <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2 border border-gray-100">
                    <select value={prod.name} onChange={(e) => updateProduct(idx, 'name', e.target.value)}
                      className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2.5 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white">
                      <option value="">-- Choisir un produit --</option>
                      {/* Un article absent de la liste — d'affiliation, ou retiré
                          du catalogue — reste affiché : la liste sert à choisir,
                          pas à effacer ce qui est déjà sur la commande. */}
                      {prod.name && !stockProducts.some(p => p.name === prod.name) && (
                        <option value={prod.name}>{prod.name}</option>
                      )}
                      {stockProducts.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                    <select value={prod.size || ''} onChange={(e) => updateProduct(idx, 'size', e.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white w-20 shrink-0">
                      <option value="">Taille</option>
                      {sizeOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <input type="number" min={1} value={prod.qty} placeholder="Qté"
                      onChange={(e) => updateProduct(idx, 'qty', e.target.value === '' ? '' : Number(e.target.value))}
                      className={`border rounded-lg px-2 py-2 text-sm text-center text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white w-14 shrink-0 ${
                        prod.name && !(Number(prod.qty) > 0) ? 'border-red-400 bg-red-50' : 'border-gray-200'
                      }`} />
                    <button onClick={() => removeProduct(idx)} aria-label="Supprimer"
                      className="p-2 rounded-lg bg-red-500 text-white hover:bg-red-600 shrink-0 transition"><Trash2 size={13} /></button>
                  </div>
                );
              })}
              <button onClick={addProduct}
                className="w-full border-2 border-dashed border-gray-200 rounded-lg py-2.5 text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 flex items-center justify-center gap-1.5 transition-colors">
                <Plus size={14} /> Ajouter un produit
              </button>
              {qtyManquante && (
                <p className="text-xs text-red-600 font-medium">
                  ⚠️ Indiquez la quantité de chaque produit — elle sert au calcul du profit.
                </p>
              )}
              {/* Recalculée en direct à chaque produit ajouté/retiré ou
                  quantité changée — c'est ce total que lira le Rapport de
                  Profit pour le coût d'achat de cette commande. */}
              <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                <span className="text-xs font-medium text-blue-700">Quantité totale (utilisée dans Profit)</span>
                <span className="text-sm font-bold text-blue-800">{qteTotale}</span>
              </div>
            </div>
          </div>

          {/* PAIEMENT & OPTIONS */}
          <div>
            <SectionTitle icon="💰" label="Paiement & Options" />
            <div className="grid grid-cols-2 gap-4 items-end">
              <Field label="Prix total (DH)" icon="💵">
                <input type="number" inputMode="decimal" autoComplete="off" value={form.prix} onChange={(e) => u('prix', e.target.value)} className={inputCls} placeholder="0.00" />
              </Field>
              <Field label="Échange" icon="🔄">
                <button onClick={() => u('echange', !form.echange)}
                  className={`w-full py-2.5 rounded-lg text-sm font-bold transition-colors ${form.echange ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-red-500 text-white hover:bg-red-600'}`}>
                  {form.echange ? 'OUI' : 'NON'}
                </button>
              </Field>
              <Field label="Nombre de commandes">
                <input type="number" min={1} max={500} value={form.qty} onChange={(e) => u('qty', Math.max(1, Number(e.target.value)))} className={inputCls} />
              </Field>
            </div>
          </div>

          {/* NOTES */}
          <div>
            <SectionTitle icon="📝" label="Notes" />
            <div className="space-y-4">
              <Field label="Note interne" icon="🔒">
                <textarea value={form.noteInterne} onChange={(e) => u('noteInterne', e.target.value)} rows={2}
                  className={`${inputCls} resize-none`} placeholder="Note interne..." />
              </Field>
              <Field label="Note Livraison" icon="🚛">
                <textarea value={form.noteLivraison} onChange={(e) => u('noteLivraison', e.target.value)} rows={2}
                  className={`${inputCls} resize-none`} placeholder="Note pour le livreur..." />
              </Field>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/80 rounded-b-2xl shrink-0 pb-[env(safe-area-inset-bottom,16px)]">
          <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition">Annuler</button>
          <button onClick={handleSave} disabled={!form.nom || !form.telephone || !form.prix || qtyManquante}
            title={qtyManquante ? 'Indiquez la quantité de chaque produit avant de créer la commande' : undefined}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2">
            <Check size={14} />
            {form.qty > 1 ? `Créer ${form.qty} commandes` : 'Créer la commande'}
          </button>
        </div>
      </div>
    </div>
  );
}
