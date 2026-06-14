import React, { useState, useEffect } from 'react';
import { cloudGet, cloudSet } from '../lib/cloudSettings';
import {
  Settings, Link2, CheckCircle2, XCircle, Loader2,
  Eye, EyeOff, RefreshCw, Save, AlertTriangle,
  ShoppingCart, Truck, X, Clock, Users, UserPlus, Trash2,
} from 'lucide-react';

const TIMEZONES = [
  { value: 'Africa/Casablanca',  label: 'Maroc (Casablanca) — UTC+1' },
  { value: 'Europe/Paris',       label: 'France (Paris) — UTC+2' },
  { value: 'Europe/London',      label: 'Royaume-Uni (Londres) — UTC+1' },
  { value: 'Africa/Cairo',       label: 'Égypte (Le Caire) — UTC+3' },
  { value: 'Asia/Riyadh',        label: 'Arabie Saoudite (Riyad) — UTC+3' },
  { value: 'Asia/Dubai',         label: 'EAU (Dubaï) — UTC+4' },
  { value: 'America/New_York',   label: 'USA Est (New York) — UTC-4' },
  { value: 'UTC',                label: 'UTC — UTC+0' },
];

function InputField({ label, type = 'text', value, onChange, placeholder, show, onToggleShow }) {
  const isPassword = type === 'password';
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <div className="relative">
        <input
          type={isPassword && show ? 'text' : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 pr-10"
        />
        {isPassword && (
          <button type="button" onClick={onToggleShow}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}

function Modal({ open, onClose, title, icon, iconBg, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg z-10 overflow-hidden">
        <div className={`flex items-center gap-3 px-6 py-4 border-b ${iconBg}`}>
          <div className="p-2 rounded-lg bg-white/60">{icon}</div>
          <h2 className="font-bold text-gray-800 text-lg">{title}</h2>
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600 transition">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export default function SettingsPage({ onWooOrdersImported }) {
  const [openModal, setOpenModal] = useState(null);

  /* ── WooCommerce state ── */
  const [woo, setWoo] = useState({ siteUrl: '', consumerKey: '', consumerSecret: '', showKey: false, showSecret: false, testStatus: 'idle', syncStatus: 'idle', saved: false });

  /* ── Ozon Express state ── */
  const [auzone, setAuzone] = useState({ customerId: '', apiKey: '', showKey: false, testStatus: 'idle', saved: false });

  /* ── Timezone state ── */
  const [timezone, setTimezone] = useState(localStorage.getItem('system_timezone') || 'Africa/Casablanca');
  const [tzSaved, setTzSaved] = useState(!!localStorage.getItem('system_timezone'));

  function saveTz(tz) {
    localStorage.setItem('system_timezone', tz);
    setTimezone(tz);
    setTzSaved(true);
  }

  /* ── Users state ── */
  const ROLES = ['Admin', 'Confirmation', 'Comptabilité', 'Suivi', 'Livraison'];
  const [usersList, setUsersList] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user_profiles') || '[]'); } catch { return []; }
  });
  const [userForm, setUserForm] = useState({ name: '', email: '', role: 'Confirmation' });
  const [usersSaved, setUsersSaved] = useState(false);

  function saveUserProfiles(list) {
    setUsersList(list);
    localStorage.setItem('user_profiles', JSON.stringify(list));
    cloudSet('user_profiles', list);
    setUsersSaved(true);
    setTimeout(() => setUsersSaved(false), 2000);
  }
  function addUser() {
    if (!userForm.name.trim() || !userForm.email.trim()) return;
    if (usersList.find(u => u.email === userForm.email)) return;
    saveUserProfiles([...usersList, { ...userForm }]);
    setUserForm({ name: '', email: '', role: 'Confirmation' });
  }
  function deleteUser(email) { saveUserProfiles(usersList.filter(u => u.email !== email)); }

  useEffect(() => {
    cloudGet('user_profiles').then(data => {
      if (Array.isArray(data) && data.length > 0) {
        setUsersList(data);
        localStorage.setItem('user_profiles', JSON.stringify(data));
      }
    });
  }, []);

  /* ── Load configs from Supabase on mount ── */
  useEffect(() => {
    cloudGet('woo_config').then(saved => {
      if (saved?.consumerKey) setWoo(p => ({ ...p, siteUrl: saved.siteUrl || '', consumerKey: saved.consumerKey, consumerSecret: saved.consumerSecret || '', saved: true }));
    });
    cloudGet('auzone_config').then(saved => {
      if (saved?.apiKey) setAuzone(p => ({ ...p, customerId: saved.customerId || '', apiKey: saved.apiKey, saved: true }));
    });
  }, []);

  /* ── WooCommerce handlers ── */
  function updateWoo(field, val) { setWoo((p) => ({ ...p, [field]: val, testStatus: 'idle', saved: false })); }

  async function testWoo() {
    if (!woo.siteUrl || !woo.consumerKey || !woo.consumerSecret) return;
    setWoo((p) => ({ ...p, testStatus: 'loading' }));
    try {
      const res = await fetch(`/wc-api/wp-json/wc/v3/orders?per_page=1&consumer_key=${woo.consumerKey}&consumer_secret=${woo.consumerSecret}`);
      setWoo((p) => ({ ...p, testStatus: res.ok ? 'success' : 'error' }));
    } catch { setWoo((p) => ({ ...p, testStatus: 'error' })); }
  }

  function saveWoo() {
    cloudSet('woo_config', { siteUrl: woo.siteUrl, consumerKey: woo.consumerKey, consumerSecret: woo.consumerSecret });
    setWoo((p) => ({ ...p, saved: true }));
  }

  async function syncWoo() {
    setWoo((p) => ({ ...p, syncStatus: 'loading' }));
    try {
      const res = await fetch(`/wc-api/wp-json/wc/v3/orders?status=processing,pending&per_page=50&consumer_key=${woo.consumerKey}&consumer_secret=${woo.consumerSecret}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const mapped = data.map((o) => ({
        id: `WC-${o.id}`,
        recipient: { name: `${o.billing.first_name} ${o.billing.last_name}`.trim(), address: o.billing.address_1 || '', city: o.billing.city || '', phone: o.billing.phone || '', delivery: null },
        product: { name: o.line_items?.[0]?.name || 'Produit WC', size: o.line_items?.[0]?.meta_data?.find((m) => m.key === 'pa_taille')?.value || '', qty: o.line_items?.[0]?.quantity || 1, stock: 0 },
        price: parseFloat(o.total) || 0, status: 'nouveau', note: o.customer_note || '',
        dateAdded: new Date(o.date_created).toLocaleString('fr-MA'), dateUpdated: new Date(o.date_modified).toLocaleString('fr-MA'), validated: false,
      }));
      onWooOrdersImported(mapped);
      setWoo((p) => ({ ...p, syncStatus: 'success' }));
      setTimeout(() => setWoo((p) => ({ ...p, syncStatus: 'idle' })), 3000);
    } catch { setWoo((p) => ({ ...p, syncStatus: 'error' })); setTimeout(() => setWoo((p) => ({ ...p, syncStatus: 'idle' })), 3000); }
  }

  /* ── Auzone handlers ── */
  function updateAuzone(field, val) { setAuzone((p) => ({ ...p, [field]: val, saved: false })); }

  function saveAuzone() {
    cloudSet('auzone_config', { customerId: auzone.customerId, apiKey: auzone.apiKey });
    setAuzone((p) => ({ ...p, saved: true }));
  }

  /* ── Settings cards config ── */
  const CARDS = [
    {
      id: 'woocommerce',
      title: 'WooCommerce',
      desc: 'Synchronisation automatique des commandes depuis votre boutique en ligne.',
      icon: <ShoppingCart size={22} className="text-purple-600" />,
      iconBg: 'bg-purple-100',
      cardBg: 'from-purple-50',
      saved: woo.saved,
      badge: woo.saved ? { label: 'Configuré', color: 'text-green-600 bg-green-50 border-green-200' } : null,
    },
    {
      id: 'users',
      title: 'Utilisateurs',
      desc: "Gérez les comptes de votre équipe. Chaque utilisateur apparaît dans l'historique des commandes.",
      icon: <Users size={22} className="text-indigo-600" />,
      iconBg: 'bg-indigo-100',
      cardBg: 'from-indigo-50',
      saved: usersList.length > 0,
      badge: usersList.length > 0 ? { label: `${usersList.length} utilisateur${usersList.length > 1 ? 's' : ''}`, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' } : null,
    },
    {
      id: 'timezone',
      title: 'Fuseau horaire',
      desc: "Définissez le fuseau horaire utilisé pour l'horodatage des commandes et de l'historique.",
      icon: <Clock size={22} className="text-blue-600" />,
      iconBg: 'bg-blue-100',
      cardBg: 'from-blue-50',
      saved: tzSaved,
      badge: tzSaved ? { label: timezone.split('/')[1] || timezone, color: 'text-blue-700 bg-blue-50 border-blue-200' } : null,
    },
    {
      id: 'ozonexpress',
      title: 'Ozon Express',
      desc: 'Créez des colis de livraison directement depuis vos commandes confirmées.',
      icon: <Truck size={22} className="text-orange-600" />,
      iconBg: 'bg-orange-100',
      cardBg: 'from-orange-50',
      saved: auzone.saved,
      badge: auzone.saved ? { label: 'Configuré', color: 'text-green-600 bg-green-50 border-green-200' } : null,
    },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Settings size={22} className="text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-800">Réglages</h1>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map((card) => (
          <div key={card.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
            <div className={`bg-gradient-to-r ${card.cardBg} to-white px-5 pt-5 pb-4`}>
              <div className={`inline-flex p-2.5 rounded-xl ${card.iconBg} mb-3`}>{card.icon}</div>
              <h3 className="font-bold text-gray-800 text-base">{card.title}</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{card.desc}</p>
            </div>
            <div className="px-5 pb-4 pt-3 flex items-center justify-between border-t border-gray-50">
              <button
                onClick={() => setOpenModal(card.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition"
              >
                <Settings size={12} /> Configurer
              </button>
              {card.badge && (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1 ${card.badge.color}`}>
                  <CheckCircle2 size={11} /> {card.badge.label}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── WooCommerce Modal ── */}
      <Modal open={openModal === 'woocommerce'} onClose={() => setOpenModal(null)}
        title="WooCommerce" icon={<ShoppingCart size={18} className="text-purple-600" />}
        iconBg="bg-gradient-to-r from-purple-50 to-white">
        <div className="space-y-4">
          <InputField label="URL de la boutique" value={woo.siteUrl} onChange={(v) => updateWoo('siteUrl', v)} placeholder="https://monboutique.com" />
          <InputField label="Consumer Key" type="password" value={woo.consumerKey} onChange={(v) => updateWoo('consumerKey', v)} placeholder="ck_xxxxxxxxxxxx" show={woo.showKey} onToggleShow={() => setWoo((p) => ({ ...p, showKey: !p.showKey }))} />
          <InputField label="Consumer Secret" type="password" value={woo.consumerSecret} onChange={(v) => updateWoo('consumerSecret', v)} placeholder="cs_xxxxxxxxxxxx" show={woo.showSecret} onToggleShow={() => setWoo((p) => ({ ...p, showSecret: !p.showSecret }))} />

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 flex gap-2 text-xs text-amber-700">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <span>WooCommerce → Paramètres → Avancés → REST API → Ajouter une clé</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button onClick={testWoo} disabled={!woo.siteUrl || !woo.consumerKey || !woo.consumerSecret || woo.testStatus === 'loading'}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-300 text-blue-600 text-xs font-medium hover:bg-blue-50 disabled:opacity-40 transition">
              {woo.testStatus === 'loading' ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
              Tester
            </button>
            {woo.testStatus === 'success' && <>
              <button onClick={saveWoo} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition">
                <Save size={12} /> Enregistrer
              </button>
              <button onClick={syncWoo} disabled={woo.syncStatus === 'loading'} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 disabled:opacity-60 transition">
                {woo.syncStatus === 'loading' ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                {woo.syncStatus === 'loading' ? 'Synchro...' : 'Synchroniser'}
              </button>
            </>}
            {woo.testStatus === 'success' && <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 size={12} /> Connexion OK</span>}
            {woo.testStatus === 'error' && <span className="flex items-center gap-1 text-xs text-red-600"><XCircle size={12} /> Échec</span>}
            {woo.syncStatus === 'success' && <span className="flex items-center gap-1 text-xs text-purple-600"><CheckCircle2 size={12} /> Importées</span>}
          </div>
        </div>
      </Modal>

      {/* ── Users Modal ── */}
      <Modal open={openModal === 'users'} onClose={() => setOpenModal(null)}
        title="Gestion des utilisateurs" icon={<Users size={18} className="text-indigo-600" />}
        iconBg="bg-gradient-to-r from-indigo-50 to-white">
        <div className="space-y-4">
          {/* List */}
          {usersList.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Nom', 'Rôle', 'Email', ''].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {usersList.map(u => (
                    <tr key={u.email}>
                      <td className="px-3 py-2 font-semibold text-gray-800">{u.name}</td>
                      <td className="px-3 py-2">
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{u.role}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">{u.email}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => deleteUser(u.email)} className="p-1 rounded bg-red-100 text-red-500 hover:bg-red-200">
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add form */}
          <div className="border border-dashed border-gray-300 rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-600 flex items-center gap-1"><UserPlus size={12} /> Ajouter un utilisateur</p>
            <div className="grid grid-cols-2 gap-2">
              <input value={userForm.name} onChange={e => setUserForm(p => ({...p, name: e.target.value}))} placeholder="Nom complet" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <select value={userForm.role} onChange={e => setUserForm(p => ({...p, role: e.target.value}))} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <input value={userForm.email} onChange={e => setUserForm(p => ({...p, email: e.target.value}))} placeholder="Email (même que le compte login)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            <button onClick={addUser} disabled={!userForm.name || !userForm.email}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-40 transition">
              <UserPlus size={12} /> Ajouter
            </button>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-700">
            💡 Pour créer un accès login, invitez l’utilisateur via le tableau de bord Supabase → Authentication → Invite user.
          </div>
          {usersSaved && <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 size={12} /> Sauvegardé</span>}
        </div>
      </Modal>

      {/* ── Timezone Modal ── */}
      <Modal open={openModal === 'timezone'} onClose={() => setOpenModal(null)}
        title="Fuseau horaire" icon={<Clock size={18} className="text-blue-600" />}
        iconBg="bg-gradient-to-r from-blue-50 to-white">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Sélectionner le fuseau horaire</label>
            <select
              value={timezone}
              onChange={(e) => { setTimezone(e.target.value); setTzSaved(false); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              {TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 text-xs text-blue-700">
            Heure actuelle : <strong>{new Date().toLocaleString('fr-FR', { timeZone: timezone, hour12: false })}</strong>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button onClick={() => saveTz(timezone)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition">
              <Save size={12} /> Enregistrer
            </button>
            {tzSaved && <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 size={12} /> Sauvegardé</span>}
          </div>
        </div>
      </Modal>

      {/* ── Ozon Express Modal ── */}
      <Modal open={openModal === 'ozonexpress'} onClose={() => setOpenModal(null)}
        title="Ozon Express" icon={<Truck size={18} className="text-orange-600" />}
        iconBg="bg-gradient-to-r from-orange-50 to-white">
        <div className="space-y-4">
          <InputField label="ID Client" value={auzone.customerId} onChange={(v) => updateAuzone('customerId', v)} placeholder="ex: 12345" />
          <InputField label="Clé API" type="password" value={auzone.apiKey} onChange={(v) => updateAuzone('apiKey', v)} placeholder="votre-cle-api" show={auzone.showKey} onToggleShow={() => setAuzone((p) => ({ ...p, showKey: !p.showKey }))} />

          <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2.5 text-xs text-orange-700 space-y-1">
            <p className="font-semibold">Comment obtenir vos identifiants :</p>
            <p>1. Connectez-vous sur <strong>client.ozonexpress.ma</strong></p>
            <p>2. Allez dans <strong>Comptes → Generate your API key</strong></p>
            <p>3. Copiez votre <strong>ID Client</strong> et votre <strong>Clé API</strong> ici</p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button onClick={saveAuzone} disabled={!auzone.customerId || !auzone.apiKey}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 text-white text-xs font-medium hover:bg-orange-600 disabled:opacity-40 transition">
              <Save size={12} /> Enregistrer
            </button>
            {auzone.saved && <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 size={12} /> Sauvegardé</span>}
          </div>
        </div>
      </Modal>
    </div>
  );
}
