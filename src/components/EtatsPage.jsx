import React, { useState } from 'react';
import { Pencil, Trash2, Plus, X, Check, RotateCcw } from 'lucide-react';
import { ALL_STATUSES } from '../data/statuses';
import { useStatuses } from '../contexts/StatusContext';

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}
function isLight(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

function StatusBadge({ label, color }) {
  return (
    <span
      className="px-3 py-1 rounded text-xs font-bold whitespace-nowrap"
      style={{ backgroundColor: color, color: isLight(color) ? '#111' : '#fff' }}
    >
      {label}
    </span>
  );
}

const EMPTY = { value: '', label: '', slug: '', color: '#6366F1', isDefault: false, order: 0, showInCommandes: true, showInColis: true };

export default function EtatsPage() {
  const { statuses, updateStatuses } = useStatuses();
  function setStatuses(fn) {
    const next = typeof fn === 'function' ? fn(statuses) : fn;
    updateStatuses(next);
  }
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [showModal, setShowModal] = useState(false);
  const [isNew, setIsNew] = useState(false);

  function openNew() {
    setIsNew(true);
    setForm({ ...EMPTY, id: Date.now(), order: statuses.length + 1 });
    setShowModal(true);
  }

  function openEdit(s) {
    setIsNew(false);
    setForm({ ...s });
    setEditing(s.id);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditing(null);
    setForm(EMPTY);
  }

  function saveForm() {
    if (!form.label.trim()) return;
    let updated;
    if (isNew) {
      const slug = form.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      updated = { ...form, slug, value: slug.replace(/-/g, '_') };
      setStatuses((p) => [...p, updated]);
    } else {
      /* Keep original value & slug — only update label, color, order, isDefault */
      updated = { ...form };
      setStatuses((p) => p.map((s) => (s.id === editing ? updated : s)));
    }
    closeModal();
  }

  function deleteStatus(id) {
    setStatuses((p) => p.filter((s) => s.id !== id));
  }

  function toggleDefault(id) {
    setStatuses((p) =>
      p.map((s) => ({ ...s, isDefault: s.id === id ? !s.isDefault : s.isDefault }))
    );
  }

  function resetToDefault() {
    if (!window.confirm('Réinitialiser tous les états ? Les modifications seront perdues.')) return;
    updateStatuses(ALL_STATUSES);
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-800">Gestion des états de commande</h1>
        <div className="flex gap-2">
          <button
            onClick={resetToDefault}
            className="flex items-center gap-1.5 bg-gray-100 text-gray-600 text-sm font-semibold px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors"
            title="Réinitialiser aux états par défaut"
          >
            <RotateCcw size={13} /> Réinitialiser
          </button>
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} /> Nouvel état
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Nom</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Slug</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Couleur</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Par Défaut</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Ordre</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600" title="Visible dans Commandes">🛒 Commandes</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600" title="Visible dans Liste des colis">📦 Liste colis</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {statuses.map((s, idx) => (
              <tr
                key={s.id}
                className={`border-b border-gray-50 hover:bg-gray-50/50 ${idx % 2 === 0 ? '' : 'bg-gray-50/30'}`}
              >
                <td className="px-4 py-2.5 font-medium text-gray-800">{s.label}</td>
                <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{s.slug}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded border border-gray-200 shrink-0"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="text-xs text-gray-500 font-mono">{s.color}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <button
                    onClick={() => toggleDefault(s.id)}
                    className={`px-2.5 py-0.5 rounded text-xs font-semibold border transition-colors ${
                      s.isDefault
                        ? 'bg-green-100 text-green-700 border-green-300'
                        : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    {s.isDefault ? 'Oui' : 'Non'}
                  </button>
                </td>
                <td className="px-4 py-2.5 text-gray-500 text-center">{s.order}</td>
                {/* Commandes toggle */}
                <td className="px-4 py-2.5 text-center">
                  <button
                    onClick={() => setStatuses(p => p.map(x => x.id === s.id ? { ...x, showInCommandes: !x.showInCommandes } : x))}
                    className={`w-9 h-5 rounded-full transition-colors focus:outline-none ${
                      s.showInCommandes !== false ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                    title={s.showInCommandes !== false ? 'Masquer dans Commandes' : 'Afficher dans Commandes'}
                  >
                    <span className={`block w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${
                      s.showInCommandes !== false ? 'translate-x-3.5' : 'translate-x-0'
                    }`} />
                  </button>
                </td>
                {/* Liste colis toggle */}
                <td className="px-4 py-2.5 text-center">
                  <button
                    onClick={() => setStatuses(p => p.map(x => x.id === s.id ? { ...x, showInColis: !x.showInColis } : x))}
                    className={`w-9 h-5 rounded-full transition-colors focus:outline-none ${
                      s.showInColis !== false ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                    title={s.showInColis !== false ? 'Masquer dans Liste colis' : 'Afficher dans Liste colis'}
                  >
                    <span className={`block w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${
                      s.showInColis !== false ? 'translate-x-3.5' : 'translate-x-0'
                    }`} />
                  </button>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => openEdit(s)}
                      className="p-1.5 rounded bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                      title="Modifier"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => deleteStatus(s.id)}
                      className="p-1.5 rounded bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Preview */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-sm font-bold text-gray-600 mb-3 uppercase tracking-wide">Aperçu des états</h2>
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => (
            <StatusBadge key={s.id} label={s.label} color={s.color} />
          ))}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">
                {isNew ? 'Nouvel état' : 'Modifier l\'état'}
              </h2>
              <button onClick={closeModal} className="p-1.5 rounded hover:bg-gray-100 text-gray-400">
                <X size={16} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-blue-600 block mb-1">Nom</label>
                <input
                  value={form.label}
                  onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="Nom de l'état"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-blue-600 block mb-1">Couleur</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.color}
                      onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                      className="w-10 h-10 rounded cursor-pointer border border-gray-200"
                    />
                    <input
                      value={form.color}
                      onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                      className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                      placeholder="#000000"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-blue-600 block mb-1">Ordre</label>
                  <input
                    type="number"
                    value={form.order}
                    onChange={(e) => setForm((p) => ({ ...p, order: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
              </div>
              {form.label && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Aperçu</label>
                  <StatusBadge label={form.label} color={form.color} />
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isDefault}
                  onChange={(e) => setForm((p) => ({ ...p, isDefault: e.target.checked }))}
                  className="w-4 h-4 rounded" />
                <span className="text-sm text-gray-700">Par défaut</span>
              </label>
              <div className="flex gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.showInCommandes !== false}
                    onChange={(e) => setForm((p) => ({ ...p, showInCommandes: e.target.checked }))}
                    className="w-4 h-4 rounded accent-blue-500" />
                  <span className="text-sm text-gray-700">🛒 Visible dans Commandes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.showInColis !== false}
                    onChange={(e) => setForm((p) => ({ ...p, showInColis: e.target.checked }))}
                    className="w-4 h-4 rounded accent-green-500" />
                  <span className="text-sm text-gray-700">📦 Visible dans Liste colis</span>
                </label>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-xl">
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={saveForm}
                disabled={!form.label.trim()}
                className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-40 transition-colors flex items-center gap-2"
              >
                <Check size={14} /> Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
