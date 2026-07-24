import React, { useState } from 'react';
import { usePermissions, ALL_PERMISSIONS } from '../lib/permissions';
import { UserPlus, Trash2, Edit3, X, Shield, Phone, Mail, Camera, Save, ArrowLeft, Eye, EyeOff, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

/* ── Performance de l'équipe (agrégée depuis order_history) ── */
function parseFrTs(s) {
  const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})[ ,T]*(\d{1,2})?:?(\d{1,2})?/);
  if (!m) return null;
  const d = new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0));
  return isNaN(d.getTime()) ? null : d;
}

function TeamPerformance() {
  const [rows, setRows] = useState([]);
  const [period, setPeriod] = useState(30);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      // order_history peut être volumineux : pagination par 1000 (max 10 000 lignes récentes).
      let all = [];
      for (let from = 0; from < 10000; from += 1000) {
        const { data, error } = await supabase
          .from('order_history')
          .select('status, user_name, timestamp')
          .order('id', { ascending: false })
          .range(from, from + 999);
        if (error || !data?.length) break;
        all = all.concat(data);
        if (data.length < 1000) break;
      }
      if (!cancelled) { setRows(all); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const stats = React.useMemo(() => {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - period + 1);
    const map = new Map();
    for (const r of rows) {
      const d = parseFrTs(r.timestamp);
      if (!d || d < cutoff) continue;
      const name = r.user_name || 'inconnu';
      const s = map.get(name) || { name, total: 0, confirme: 0, livre: 0, refuse: 0, last: null };
      s.total++;
      if (r.status === 'confirme') s.confirme++;
      if (r.status === 'livre') s.livre++;
      if (r.status === 'refuse' || r.status === 'annule') s.refuse++;
      if (!s.last || d > s.last) s.last = d;
      map.set(name, s);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [rows, period]);

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Performance de l'équipe</h2>
          <p className="text-xs text-gray-500">Actions enregistrées dans l'historique des commandes</p>
        </div>
        <div className="flex gap-1.5">
          {[7, 30, 90].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${period === p ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
              {p} jours
            </button>
          ))}
        </div>
      </div>
      <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
        {loading ? (
          <div className="p-4 space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-9 bg-gray-100 rounded-lg animate-pulse" />)}
          </div>
        ) : stats.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">Aucune activité sur cette période</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Utilisateur</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                  <th className="px-4 py-3 text-center">Confirmées</th>
                  <th className="px-4 py-3 text-center">Livrées</th>
                  <th className="px-4 py-3 text-center">Refus/Annul.</th>
                  <th className="px-4 py-3 text-center">Taux succès</th>
                  <th className="px-4 py-3 text-right">Dernière activité</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s, i) => {
                  const denom = s.livre + s.refuse;
                  const taux = denom > 0 ? Math.round((s.livre / denom) * 100) : null;
                  return (
                    <tr key={s.name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 font-semibold text-gray-800">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                            {s.name[0]?.toUpperCase()}
                          </div>
                          <span className="truncate max-w-[200px]">{s.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-gray-700">{s.total}</td>
                      <td className="px-4 py-3 text-center text-green-600 font-medium">{s.confirme}</td>
                      <td className="px-4 py-3 text-center text-emerald-600 font-medium">{s.livre}</td>
                      <td className="px-4 py-3 text-center text-red-500 font-medium">{s.refuse}</td>
                      <td className="px-4 py-3 text-center">
                        {taux !== null ? (
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${taux >= 70 ? 'bg-green-100 text-green-700' : taux >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>
                            {taux}%
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-500">
                        {s.last ? s.last.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ModeratorsPage() {
  const { moderators, setModerators, isAdmin } = usePermissions();
  const navigate = useNavigate();
  const [editModal, setEditModal] = useState(null); // null | 'new' | moderator object
  const [form, setForm] = useState({ name: '', email: '', phone: '', photo: '', permissions: [], active: true });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pwMsg, setPwMsg] = useState('');

  function openAdd() {
    setForm({ name: '', email: '', phone: '', photo: '', permissions: [], active: true });
    setPassword(''); setShowPassword(false); setPwMsg('');
    setEditModal('new');
  }

  function openEdit(mod) {
    setForm({ ...mod, permissions: mod.permissions || [] });
    setPassword(''); setShowPassword(false); setPwMsg('');
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

  async function save() {
    if (!form.name.trim() || !form.email.trim()) return;
    if (password && password.length < 6) {
      setPwMsg('Minimum 6 caractères');
      return;
    }
    const entry = { ...form, role: 'moderator' };
    if (editModal === 'new') {
      if (moderators.find(m => m.email === form.email)) return;
      setModerators([...moderators, entry]);
    } else {
      setModerators(moderators.map(m => m.email === editModal.email ? { ...entry } : m));
    }
    if (password) {
      try {
        const { error } = await supabase.auth.admin.updateUserById(
          form.email, { password }
        ).catch(() => ({}));
        if (error) setPwMsg('Mot de passe enregistré localement (mise à jour Supabase nécessite accès admin)');
      } catch {}
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
                <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
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

      {/* Performance de l'équipe */}
      <TeamPerformance />

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

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  <Lock size={12} className="inline mr-1" />Mot de passe {editModal !== 'new' && '(laisser vide pour ne pas changer)'}
                </label>
                <div className="relative">
                  <input value={password} onChange={e => { setPassword(e.target.value); setPwMsg(''); }}
                    type={showPassword ? 'text' : 'password'}
                    placeholder={editModal === 'new' ? 'Mot de passe du compte' : 'Nouveau mot de passe'}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {pwMsg && <p className={`text-xs mt-1 ${pwMsg.includes('✓') ? 'text-green-600' : 'text-red-500'}`}>{pwMsg}</p>}
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
