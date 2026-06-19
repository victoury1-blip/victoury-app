import React, { useState } from 'react';
import { usePermissions, ALL_PERMISSIONS } from '../lib/permissions';
import { UserPlus, Trash2, Edit3, X, Shield, Phone, Mail, Camera, Save, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ModeratorsPage() {
  const { moderators, setModerators, isAdmin } = usePermissions();
  const navigate = useNavigate();
  const [editModal, setEditModal] = useState(null); // null | 'new' | moderator object
  const [form, setForm] = useState({ name: '', email: '', phone: '', photo: '', permissions: [], active: true });

  function openAdd() {
    setForm({ name: '', email: '', phone: '', photo: '', permissions: [], active: true });
    setEditModal('new');
  }

  function openEdit(mod) {
    setForm({ ...mod, permissions: mod.permissions || [] });
    setEditModal(mod);
  }

  function togglePermission(key) {
    setForm(p => ({
      ...p,
      permissions: p.permissions.includes(key)
        ? p.permissions.filter(k => k !== key)
        : [...p.permissions, key],
    }));
  }

  function selectAll() {
    setForm(p => ({ ...p, permissions: ALL_PERMISSIONS.map(p => p.key) }));
  }

  function save() {
    if (!form.name.trim() || !form.email.trim()) return;
    const entry = { ...form, role: 'moderator' };
    if (editModal === 'new') {
      if (moderators.find(m => m.email === form.email)) return;
      setModerators([...moderators, entry]);
    } else {
      setModerators(moderators.map(m => m.email === editModal.email ? { ...entry } : m));
    }
    setEditModal(null);
  }

  function deleteMod(email) {
    if (!window.confirm('Supprimer ce modérateur ?')) return;
    setModerators(moderators.filter(m => m.email !== email));
  }

  function toggleActive(email) {
    setModerators(moderators.map(m => m.email === email ? { ...m, active: !m.active } : m));
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-lg">
        <div className="text-center">
          <Shield size={48} className="mx-auto mb-3 text-gray-300" />
          <p>Accès réservé aux administrateurs</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Gestion des Modérateurs</h1>
          <p className="text-sm text-gray-500 mt-1">Gérez les accès et permissions de votre équipe</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition shadow-sm">
          <UserPlus size={16} /> <span className="hidden sm:inline">Ajouter un modérateur</span><span className="sm:hidden">Ajouter</span>
        </button>
      </div>

      {/* Table - desktop */}
      <div className="hidden sm:block bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/80">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Photo</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Nom</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Téléphone</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Permissions</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Statut</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {moderators.map(mod => (
              <tr key={mod.email} className="hover:bg-gray-50/50 transition">
                <td className="px-4 py-3">
                  {mod.photo ? (
                    <img src={mod.photo} alt="" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">
                      {(mod.name || '?')[0].toUpperCase()}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 font-semibold text-gray-800">{mod.name}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{mod.email}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">{mod.phone || '-'}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(mod.permissions || []).map(p => {
                      const perm = ALL_PERMISSIONS.find(x => x.key === p);
                      const colors = {
                        ajout_commandes: 'bg-green-100 text-green-700',
                        modif_commandes: 'bg-blue-100 text-blue-700',
                        suppr_commandes: 'bg-red-100 text-red-700',
                        livraison: 'bg-purple-100 text-purple-700',
                        factures: 'bg-yellow-100 text-yellow-800',
                        reglages: 'bg-gray-200 text-gray-700',
                        stock: 'bg-orange-100 text-orange-700',
                        ramassage: 'bg-teal-100 text-teal-700',
                        retour: 'bg-pink-100 text-pink-700',
                        profit: 'bg-indigo-100 text-indigo-700',
                        etats: 'bg-cyan-100 text-cyan-700',
                      };
                      return (
                        <span key={p} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colors[p] || 'bg-gray-100 text-gray-600'}`}>
                          {perm?.label || p}
                        </span>
                      );
                    })}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActive(mod.email)}
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${mod.active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {mod.active !== false ? 'Actif' : 'Inactif'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => openEdit(mod)} className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition">
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => deleteMod(mod.email)} className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {moderators.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                  <Shield size={40} className="mx-auto mb-3 text-gray-200" />
                  <p className="font-medium">Aucun modérateur</p>
                  <p className="text-xs mt-1">Ajoutez des membres d'équipe pour gérer les accès</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Cards - mobile */}
      <div className="sm:hidden space-y-3">
        {moderators.map(mod => (
          <div key={mod.email} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-start gap-3 mb-3">
              {mod.photo ? (
                <img src={mod.photo} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0">
                  {(mod.name || '?')[0].toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800 truncate">{mod.name}</h3>
                  <button onClick={() => toggleActive(mod.email)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${mod.active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {mod.active !== false ? 'Actif' : 'Inactif'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 truncate">{mod.email}</p>
                {mod.phone && <p className="text-xs text-gray-400">{mod.phone}</p>}
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mb-3">
              {(mod.permissions || []).map(p => {
                const perm = ALL_PERMISSIONS.find(x => x.key === p);
                const colors = {
                  ajout_commandes: 'bg-green-100 text-green-700',
                  modif_commandes: 'bg-blue-100 text-blue-700',
                  suppr_commandes: 'bg-red-100 text-red-700',
                  livraison: 'bg-purple-100 text-purple-700',
                  factures: 'bg-yellow-100 text-yellow-800',
                  reglages: 'bg-gray-200 text-gray-700',
                };
                return (
                  <span key={p} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colors[p] || 'bg-gray-100 text-gray-600'}`}>
                    {perm?.label || p}
                  </span>
                );
              })}
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
              <button onClick={() => openEdit(mod)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100">
                <Edit3 size={12} /> Modifier
              </button>
              <button onClick={() => deleteMod(mod.email)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-50 text-red-500 text-xs font-medium hover:bg-red-100">
                <Trash2 size={12} /> Supprimer
              </button>
            </div>
          </div>
        ))}
        {moderators.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
            <Shield size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="font-medium">Aucun modérateur</p>
          </div>
        )}
      </div>

      {/* Back to settings */}
      <button onClick={() => navigate('/reglage')}
        className="mt-6 flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition">
        <ArrowLeft size={16} /> Retour aux réglages
      </button>

      {/* Add/Edit Modal */}
      {editModal !== null && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setEditModal(null)}>
          <div className="fixed inset-0 bg-black/40" />
          <div className="relative bg-white rounded-t-xl sm:rounded-xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-xl z-10">
              <h2 className="text-lg font-bold text-gray-800">
                {editModal === 'new' ? 'Ajouter un modérateur' : 'Modifier le modérateur'}
              </h2>
              <button onClick={() => setEditModal(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Photo */}
              <div className="flex items-center gap-4">
                {form.photo ? (
                  <img src={form.photo} alt="" className="w-16 h-16 rounded-full object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xl font-bold">
                    {(form.name || '?')[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div>
                  <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">
                    <Camera size={12} /> Photo
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = ev => setForm(p => ({ ...p, photo: ev.target.result }));
                      reader.readAsDataURL(file);
                    }} />
                  </label>
                  {form.photo && <button onClick={() => setForm(p => ({ ...p, photo: '' }))} className="text-xs text-red-500 hover:underline mt-1 block">Supprimer</button>}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nom complet</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Hamza Mitre"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  <Mail size={12} className="inline mr-1" />Email (même que le compte login)
                </label>
                <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="moderateur@example.com" type="email"
                  disabled={editModal !== 'new'}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-50 disabled:text-gray-500" />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  <Phone size={12} className="inline mr-1" />Téléphone
                </label>
                <input value={form.phone || ''} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="0661842317"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>

              {/* Permissions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-600">Permissions</label>
                  <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">Tout sélectionner</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_PERMISSIONS.map(p => {
                    const active = form.permissions.includes(p.key);
                    return (
                      <button key={p.key} onClick={() => togglePermission(p.key)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition ${active ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${active ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                          {active && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Info */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-700">
                💡 L'utilisateur doit avoir un compte login (créé via Supabase → Authentication → Invite user). Les permissions contrôlent ce qu'il voit dans son interface.
              </div>

              {/* Save */}
              <button onClick={save} disabled={!form.name.trim() || !form.email.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition">
                <Save size={14} /> {editModal === 'new' ? 'Ajouter' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
