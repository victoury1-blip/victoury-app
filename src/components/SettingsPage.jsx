import React, { useState, useEffect } from 'react';
import { cloudGet, cloudSet } from '../lib/cloudSettings';
import { supabase } from '../lib/supabase';
import {
  Settings, Link2, CheckCircle2, XCircle, Loader2,
  Eye, EyeOff, RefreshCw, Save, AlertTriangle,
  ShoppingCart, Truck, X, Clock, Users, UserPlus, Trash2, DatabaseZap, Volume2, Play,
  Search, ArrowDownCircle, Tag, Upload, Bell, Phone, MessageCircle,
} from 'lucide-react';
import { requestPermission } from '../hooks/useNotifications';
import { getWaTemplates, saveWaTemplates, STATUS_LABELS_AR, TEMPLATE_VARS } from '../lib/whatsappTemplates';

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-xl sm:rounded-xl shadow-2xl w-full max-w-lg z-10 overflow-hidden">
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

export default function SettingsPage({ onWooOrdersImported, orders = [], setOrders }) {
  const [openModal, setOpenModal] = useState(null);
  const [syncLogs, setSyncLogs] = useState([]);
  const [ozoneSyncState, setOzoneSyncState] = useState({ status: 'idle', message: '', count: 0 });
  const [ozoneTrackInput, setOzoneTrackInput] = useState('');
  const [ozoneTrackResult, setOzoneTrackResult] = useState(null);
  const [ozoneTrackLoading, setOzoneTrackLoading] = useState(false);

  useEffect(() => {
    supabase.from('settings').select('value').eq('key', 'wc_sync_logs').single()
      .then(({ data }) => { if (Array.isArray(data?.value)) setSyncLogs(data.value); });
  }, []);

  /* ── WooCommerce state ── */
  const [woo, setWoo] = useState({ siteUrl: '', consumerKey: '', consumerSecret: '', showKey: false, showSecret: false, testStatus: 'idle', syncStatus: 'idle', saved: false });

  /* ── Ozon Express state ── */
  const [auzone, setAuzone] = useState({ customerId: '', apiKey: '', showKey: false, testStatus: 'idle', saved: false });

  /* ── Phone colors state ── */
  const [phoneColors, setPhoneColors] = useState(() => {
    try { return JSON.parse(localStorage.getItem('phone_colors') || '{}'); } catch { return {}; }
  });
  const defaultPhoneColors = { livreBg: '#047857', livreText: '#ffffff', knownBg: '#fbbf24', knownText: '#111827' };
  const pc = { ...defaultPhoneColors, ...phoneColors };
  function savePhoneColors(c) {
    const merged = { ...pc, ...c };
    setPhoneColors(merged);
    localStorage.setItem('phone_colors', JSON.stringify(merged));
    cloudSet('phone_colors', merged);
  }

  /* ── WhatsApp templates state ── */
  const [waTemplates, setWaTemplates] = useState(() => getWaTemplates());
  function saveWaTemplate(status, changes) {
    const next = { ...waTemplates, [status]: { ...waTemplates[status], ...changes } };
    setWaTemplates(next);
    saveWaTemplates(next);
    cloudSet('victoury_wa_templates', next);
  }

  /* ── Notification sound state ── */
  const [notifCfg, setNotifCfg] = useState(() => {
    try { return JSON.parse(localStorage.getItem('notification_sound') || '{}'); } catch { return {}; }
  });

  /* ── Push notifications state ── */
  const [pushCfg, setPushCfg] = useState(() => {
    try { return JSON.parse(localStorage.getItem('push_notifications') || '{}'); } catch { return {}; }
  });
  const [pushPermission, setPushPermission] = useState(() => 'Notification' in window ? Notification.permission : 'denied');

  function savePushCfg(cfg) {
    setPushCfg(cfg);
    localStorage.setItem('push_notifications', JSON.stringify(cfg));
    cloudSet('push_notifications', cfg);
  }

  async function togglePush() {
    if (pushCfg.enabled) {
      savePushCfg({ ...pushCfg, enabled: false });
    } else {
      const perm = await requestPermission();
      setPushPermission(perm);
      if (perm === 'granted') savePushCfg({ ...pushCfg, enabled: true });
    }
  }

  function saveNotifCfg(cfg) {
    setNotifCfg(cfg);
    localStorage.setItem('notification_sound', JSON.stringify(cfg));
    cloudSet('notification_sound', cfg);
  }

  function playTestSound(cfg) {
    const volume = (cfg.volume ?? 80) / 100;
    if (cfg.customSound) {
      const audio = new Audio(cfg.customSound);
      audio.volume = volume;
      audio.play().catch(() => {});
    } else {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5);
      } catch {}
    }
  }

  /* ── App customization state ── */
  const [appCfg, setAppCfg] = useState(() => {
    try { return JSON.parse(localStorage.getItem('victoury_app_config') || '{}'); } catch { return {}; }
  });
  const [appSaved, setAppSaved] = useState(false);

  function saveAppCfg(cfg) {
    setAppCfg(cfg);
    localStorage.setItem('victoury_app_config', JSON.stringify(cfg));
    cloudSet('victoury_app_config', cfg);
    setAppSaved(true);
    setTimeout(() => setAppSaved(false), 2000);
  }

  /* ── Shop / Label config state ── */
  const [shopCfg, setShopCfg] = useState(() => {
    try { return JSON.parse(localStorage.getItem('victoury_shop_config') || '{}'); } catch { return {}; }
  });
  const [shopSaved, setShopSaved] = useState(false);

  function saveShopCfg(cfg) {
    setShopCfg(cfg);
    localStorage.setItem('victoury_shop_config', JSON.stringify(cfg));
    cloudSet('victoury_shop_config', cfg);
    setShopSaved(true);
    setTimeout(() => setShopSaved(false), 2000);
  }

  /* ── Timezone state ── */
  const [timezone, setTimezone] = useState(() => { try { const raw = localStorage.getItem('system_timezone'); return raw ? JSON.parse(raw) : 'Africa/Casablanca'; } catch { return localStorage.getItem('system_timezone') || 'Africa/Casablanca'; } });
  const [tzSaved, setTzSaved] = useState(!!localStorage.getItem('system_timezone'));

  function saveTz(tz) {
    localStorage.setItem('system_timezone', tz);
    cloudSet('system_timezone', tz);
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
    cloudGet('victoury_app_config').then(saved => {
      if (saved && Object.keys(saved).length > 0) {
        setAppCfg(saved);
        localStorage.setItem('victoury_app_config', JSON.stringify(saved));
      }
    });
    cloudGet('notification_sound').then(saved => {
      if (saved && typeof saved === 'object') { setNotifCfg(saved); localStorage.setItem('notification_sound', JSON.stringify(saved)); }
    });
    cloudGet('system_timezone').then(saved => {
      if (saved) { setTimezone(saved); localStorage.setItem('system_timezone', JSON.stringify(saved)); setTzSaved(true); }
    });
    cloudGet('victoury_shop_config').then(saved => {
      if (saved && Object.keys(saved).length > 0) {
        setShopCfg(saved);
        localStorage.setItem('victoury_shop_config', JSON.stringify(saved));
      }
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
    const cfg = { siteUrl: woo.siteUrl, consumerKey: woo.consumerKey, consumerSecret: woo.consumerSecret };
    localStorage.setItem('woo_config', JSON.stringify(cfg));
    cloudSet('woo_config', cfg);
    setWoo((p) => ({ ...p, saved: true }));
  }

  async function syncWoo() {
    setWoo((p) => ({ ...p, syncStatus: 'loading' }));
    try {
      const res = await fetch(`/wc-api/wp-json/wc/v3/orders?status=processing,pending&per_page=50&consumer_key=${woo.consumerKey}&consumer_secret=${woo.consumerSecret}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const getMeta = (meta, ...keys) => {
        if (!meta) return '';
        for (const k of keys) { const m = meta.find(x => x.key === k || x.key === `attribute_${k}`); if (m?.value) return String(m.value); }
        for (const k of keys) { const m = meta.find(x => x.key?.toLowerCase().includes(k.replace('pa_', ''))); if (m?.display_value || m?.value) return String(m.display_value || m.value); }
        return '';
      };
      const mapped = data.map((o) => {
        const products = (o.line_items || []).map(item => ({ name: item.name || 'Produit', size: getMeta(item.meta_data, 'pa_taille', 'taille', 'size'), color: getMeta(item.meta_data, 'pa_couleur', 'couleur', 'color'), qty: item.quantity || 1 }));
        const firstItem = o.line_items?.[0] || {};
        return {
          id: `WC-${o.id}`,
          recipient: { name: `${o.billing.first_name} ${o.billing.last_name}`.trim(), address: o.billing.address_1 || '', city: o.billing.city || '', phone: o.billing.phone || '', delivery: null },
          product: { name: firstItem.name || 'Produit WC', size: getMeta(firstItem.meta_data, 'pa_taille', 'taille', 'size'), color: getMeta(firstItem.meta_data, 'pa_couleur', 'couleur', 'color'), qty: (o.line_items || []).reduce((s, i) => s + (i.quantity || 1), 0), stock: 0 },
          products: products.length > 0 ? products : null,
          price: parseFloat(o.total) || 0, status: 'nouveau', note: o.customer_note || '',
          dateAdded: new Date(o.date_created).toLocaleString('fr-MA'), dateUpdated: new Date(o.date_modified).toLocaleString('fr-MA'), validated: false,
        };
      });
      onWooOrdersImported(mapped);
      setWoo((p) => ({ ...p, syncStatus: 'success' }));
      setTimeout(() => setWoo((p) => ({ ...p, syncStatus: 'idle' })), 3000);
    } catch { setWoo((p) => ({ ...p, syncStatus: 'error' })); setTimeout(() => setWoo((p) => ({ ...p, syncStatus: 'idle' })), 3000); }
  }

  /* ── Auzone handlers ── */
  function updateAuzone(field, val) { setAuzone((p) => ({ ...p, [field]: val, saved: false })); }

  function saveAuzone() {
    const cfg = { customerId: auzone.customerId, apiKey: auzone.apiKey };
    localStorage.setItem('auzone_config', JSON.stringify(cfg));
    cloudSet('auzone_config', cfg);
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
      id: 'ozonexpress',
      title: 'Ozon Express',
      desc: 'Créez des colis de livraison directement depuis vos commandes confirmées.',
      icon: <Truck size={22} className="text-orange-600" />,
      iconBg: 'bg-orange-100',
      cardBg: 'from-orange-50',
      saved: auzone.saved,
      badge: auzone.saved ? { label: 'Configuré', color: 'text-green-600 bg-green-50 border-green-200' } : null,
    },
    {
      id: 'ozonesync',
      title: 'Sync statuts Ozone',
      desc: 'Récupérez les statuts de vos colis depuis Ozone Express via tracking number.',
      icon: <ArrowDownCircle size={22} className="text-teal-600" />,
      iconBg: 'bg-teal-100',
      cardBg: 'from-teal-50',
      saved: auzone.saved,
      badge: auzone.saved ? { label: 'Prêt', color: 'text-teal-700 bg-teal-50 border-teal-200' } : null,
    },
    {
      id: 'etiquettes',
      title: 'Étiquettes',
      desc: 'Personnalisez vos étiquettes de livraison : logo, nom, téléphone SAV et note.',
      icon: <Tag size={22} className="text-pink-600" />,
      iconBg: 'bg-pink-100',
      cardBg: 'from-pink-50',
      saved: !!shopCfg.shopName,
      badge: shopCfg.shopName ? { label: shopCfg.shopName, color: 'text-pink-700 bg-pink-50 border-pink-200' } : null,
    },
    {
      id: 'personnalisation',
      title: 'Personnalisation',
      desc: "Personnalisez le nom, le logo et le fuseau horaire de l'application.",
      icon: <Settings size={22} className="text-cyan-600" />,
      iconBg: 'bg-cyan-100',
      cardBg: 'from-cyan-50',
      saved: !!(appCfg.appName || appCfg.appLogo),
      badge: appCfg.appName ? { label: appCfg.appName, color: 'text-cyan-700 bg-cyan-50 border-cyan-200' } : null,
    },
    {
      id: 'notifications',
      title: 'Notifications',
      desc: 'Sons de notification, notifications push pour nouvelles commandes et alertes.',
      icon: <Volume2 size={22} className="text-green-600" />,
      iconBg: 'bg-green-100',
      cardBg: 'from-green-50',
      saved: notifCfg.enabled !== false,
      badge: notifCfg.enabled !== false ? { label: 'Activé', color: 'text-green-600 bg-green-50 border-green-200' } : null,
    },
    {
      id: 'phone_colors',
      title: 'ألوان الهاتف',
      desc: 'تخصيص ألوان أرقام الهاتف (عملاء معروفين / تم التوصيل).',
      icon: <Phone size={22} className="text-purple-600" />,
      iconBg: 'bg-purple-100',
      cardBg: 'from-purple-50',
      saved: true,
    },
    {
      id: 'wa_templates',
      title: 'رسائل WhatsApp',
      desc: 'تخصيص الرسائل التلقائية اللي كتمشي للكليان.',
      icon: <MessageCircle size={22} className="text-green-600" />,
      iconBg: 'bg-green-100',
      cardBg: 'from-green-50',
      saved: true,
    },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Settings size={22} className="text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-800">Réglages</h1>
      </div>

      {/* Cache / DB section */}
      <div className="mb-5 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-red-50 to-white px-5 pt-5 pb-4">
          <div className="inline-flex p-2.5 rounded-xl bg-red-100 mb-3"><DatabaseZap size={22} className="text-red-600" /></div>
          <h3 className="font-bold text-gray-800 text-base">Cache local &amp; Base de données</h3>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">Vider le cache local pour recharger toutes les données depuis Supabase. À utiliser si des commandes supposément supprimées réapparaissent sur un autre appareil.</p>
        </div>
        <div className="px-5 pb-4 pt-3 border-t border-gray-50 flex flex-wrap gap-2">
          <button
            onClick={async () => {
              if (!window.confirm('Vider le cache local et recharger depuis Supabase ?')) return;
              /* Sync remote deleted IDs first */
              const { data } = await supabase.from('settings').select('value').eq('key', 'deleted_order_ids').single();
              const remote = Array.isArray(data?.value) ? data.value : [];
              const local = JSON.parse(localStorage.getItem('deleted_order_ids') || '[]');
              const merged = [...new Set([...remote, ...local])];
              localStorage.setItem('deleted_order_ids', JSON.stringify(merged));
              window.location.reload();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition"
          >
            <RefreshCw size={12} /> Actualiser depuis Supabase
          </button>
          <button
            onClick={async () => {
              if (!window.confirm('⚠️ Réinitialiser TOUT le cache local ? (les suppressions seront sync depuis Supabase)')) return;
              const keepsafe = ['auzone_config','woo_config','livreurs','system_timezone','user_profiles','frais_1','victoury_factures','victoury_manual_facture','victoury_recu_ids','notification_sound','victoury_shop_config','victoury_app_config','victoury_statuses','ad_transfers','vict_counter','victoury_sent_livreur'];
              const saved = {};
              keepsafe.forEach(k => { const v = localStorage.getItem(k); if (v) saved[k] = v; });
              localStorage.clear();
              Object.entries(saved).forEach(([k, v]) => localStorage.setItem(k, v));
              /* Re-sync deleted IDs from Supabase */
              const { data } = await supabase.from('settings').select('value').eq('key', 'deleted_order_ids').single();
              if (data?.value) localStorage.setItem('deleted_order_ids', JSON.stringify(data.value));
              window.location.reload();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition"
          >
            <Trash2 size={12} /> Réinitialiser le cache
          </button>
        </div>
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

      {/* ── Notifications Modal ── */}
      <Modal open={openModal === 'notifications'} onClose={() => setOpenModal(null)}
        title="Notifications sonores" icon={<Volume2 size={18} className="text-green-600" />}
        iconBg="bg-gradient-to-r from-green-50 to-white">
        <div className="space-y-5">
          {/* Enable toggle */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-700">Activer le son</p>
              <p className="text-xs text-gray-500">Jouer un son à chaque nouvelle commande</p>
            </div>
            <button
              onClick={() => saveNotifCfg({ ...notifCfg, enabled: notifCfg.enabled === false ? true : false })}
              className={`relative w-11 h-6 rounded-full transition-colors ${notifCfg.enabled !== false ? 'bg-green-500' : 'bg-gray-300'}`}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${notifCfg.enabled !== false ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Volume */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Volume : {notifCfg.volume ?? 80}%</label>
            <input type="range" min="0" max="100" value={notifCfg.volume ?? 80}
              onChange={e => saveNotifCfg({ ...notifCfg, volume: Number(e.target.value) })}
              className="w-full accent-green-500" />
          </div>

          {/* Upload custom sound */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Son personnalisé (mp3 / wav)</label>
            <label className="flex items-center gap-2 cursor-pointer border border-dashed border-green-300 rounded-lg px-3 py-2.5 hover:bg-green-50 transition">
              <Volume2 size={14} className="text-green-600" />
              <span className="text-xs text-gray-600">{notifCfg.soundName || 'Cliquer pour importer un fichier audio…'}</span>
              <input type="file" accept="audio/*" className="hidden" onChange={e => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => saveNotifCfg({ ...notifCfg, customSound: ev.target.result, soundName: file.name });
                reader.readAsDataURL(file);
              }} />
            </label>
            {notifCfg.customSound && (
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-green-600 font-medium">{notifCfg.soundName}</span>
                <button onClick={() => saveNotifCfg({ ...notifCfg, customSound: null, soundName: null })}
                  className="text-xs text-red-500 hover:underline">Supprimer</button>
              </div>
            )}
          </div>

          {/* Test */}
          <button onClick={() => playTestSound(notifCfg)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition">
            <Play size={12} /> Tester le son
          </button>

          {/* Push Notifications */}
          <div className="border-t border-gray-200 pt-4 mt-2">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <Bell size={14} className="text-blue-600" /> Notifications Push
            </h3>
            <div className="flex items-center justify-between bg-blue-50 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-gray-700">Activer les notifications push</p>
                <p className="text-xs text-gray-500">Recevoir des alertes même quand l'app est en arrière-plan</p>
              </div>
              <button onClick={togglePush}
                className={`relative w-11 h-6 rounded-full transition-colors ${pushCfg.enabled ? 'bg-blue-500' : 'bg-gray-300'}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${pushCfg.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            {pushPermission === 'denied' && (
              <p className="text-xs text-red-500 mt-2">Les notifications sont bloquées par le navigateur. Activez-les dans les paramètres du site.</p>
            )}
            {pushCfg.enabled && (
              <div className="mt-3 space-y-2">
                {[
                  { key: 'newOrders', label: 'Nouvelles commandes', defaultOn: true },
                  { key: 'pendingAlerts', label: 'Commandes en attente (+10)', defaultOn: true },
                  { key: 'overdueAlerts', label: 'Commandes reportées à rappeler', defaultOn: true },
                  { key: 'noLivreurAlerts', label: 'Commandes sans livreur', defaultOn: true },
                ].map(item => (
                  <label key={item.key} className="flex items-center gap-3 text-xs text-gray-700 cursor-pointer">
                    <input type="checkbox"
                      checked={pushCfg[item.key] !== false}
                      onChange={() => savePushCfg({ ...pushCfg, [item.key]: pushCfg[item.key] === false })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    {item.label}
                  </label>
                ))}
              </div>
            )}
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

      {/* ── Personnalisation Modal ── */}
      <Modal open={openModal === 'personnalisation'} onClose={() => setOpenModal(null)}
        title="Personnalisation de l'application" icon={<Settings size={18} className="text-cyan-600" />}
        iconBg="bg-gradient-to-r from-cyan-50 to-white">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nom de l'application</label>
            <input value={appCfg.appName || ''} onChange={e => setAppCfg(p => ({ ...p, appName: e.target.value }))}
              placeholder="VICTOURY"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Fuseau horaire</label>
            <select value={timezone} onChange={e => { setTimezone(e.target.value); setTzSaved(false); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300">
              {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Logo</label>
            <div className="flex items-center gap-4">
              {appCfg.appLogo
                ? <img src={appCfg.appLogo} alt="Logo" className="h-12 object-contain rounded border border-gray-200 p-1" />
                : <div className="text-xl font-black text-gray-700 border border-gray-200 rounded px-3 py-1">{appCfg.appName || 'VICTOURY'}</div>}
              <label className="flex items-center gap-2 cursor-pointer border border-dashed border-cyan-300 rounded-lg px-3 py-2.5 hover:bg-cyan-50 transition">
                <Upload size={14} className="text-cyan-600" />
                <span className="text-xs text-gray-600">{appCfg.appLogo ? 'Changer le logo' : 'Importer un logo...'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={e => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = ev => setAppCfg(p => ({ ...p, appLogo: ev.target.result }));
                  reader.readAsDataURL(file);
                }} />
              </label>
              {appCfg.appLogo && (
                <button onClick={() => setAppCfg(p => ({ ...p, appLogo: null }))} className="text-xs text-red-500 hover:underline">Supprimer</button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button onClick={() => { saveAppCfg(appCfg); saveTz(timezone); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 text-white text-xs font-medium hover:bg-cyan-700 transition">
              <Save size={12} /> Enregistrer
            </button>
            {appSaved && <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 size={12} /> Sauvegardé</span>}
          </div>
        </div>
      </Modal>

      {/* ── Étiquettes Modal ── */}
      <Modal open={openModal === 'etiquettes'} onClose={() => setOpenModal(null)}
        title="Configuration étiquettes" icon={<Tag size={18} className="text-pink-600" />}
        iconBg="bg-gradient-to-r from-pink-50 to-white">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nom de la boutique</label>
            <input value={shopCfg.shopName || ''} onChange={e => setShopCfg(p => ({ ...p, shopName: e.target.value }))}
              placeholder="VICTOURY" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Téléphone SAV</label>
            <input value={shopCfg.shopPhone || ''} onChange={e => setShopCfg(p => ({ ...p, shopPhone: e.target.value }))}
              placeholder="06 XX XX XX XX" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Note sur étiquette</label>
            <textarea value={shopCfg.labelNote || ''} onChange={e => setShopCfg(p => ({ ...p, labelNote: e.target.value }))}
              placeholder="Ex: Merci pour votre confiance !" rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Logo</label>
            <div className="flex items-center gap-4">
              {shopCfg.logo && <img src={shopCfg.logo} alt="Logo" className="h-12 object-contain rounded border border-gray-200 p-1" />}
              <label className="flex items-center gap-2 cursor-pointer border border-dashed border-pink-300 rounded-lg px-3 py-2.5 hover:bg-pink-50 transition">
                <Upload size={14} className="text-pink-600" />
                <span className="text-xs text-gray-600">{shopCfg.logo ? 'Changer le logo' : 'Importer un logo...'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={e => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = ev => setShopCfg(p => ({ ...p, logo: ev.target.result }));
                  reader.readAsDataURL(file);
                }} />
              </label>
              {shopCfg.logo && (
                <button onClick={() => setShopCfg(p => ({ ...p, logo: null }))} className="text-xs text-red-500 hover:underline">Supprimer</button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button onClick={() => saveShopCfg(shopCfg)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-pink-600 text-white text-xs font-medium hover:bg-pink-700 transition">
              <Save size={12} /> Enregistrer
            </button>
            {shopSaved && <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 size={12} /> Sauvegardé</span>}
          </div>
        </div>
      </Modal>

      {/* ── Sync statuts depuis Ozone Modal ── */}
      <Modal open={openModal === 'ozonesync'} onClose={() => { setOpenModal(null); setOzoneTrackResult(null); setOzoneTrackInput(''); }}
        title="Sync statuts depuis Ozone" icon={<ArrowDownCircle size={18} className="text-teal-600" />}
        iconBg="bg-gradient-to-r from-teal-50 to-white">
        <div className="space-y-5">
          {!auzone.saved ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-3 text-xs text-amber-700 flex gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>Veuillez d'abord configurer vos identifiants Ozone Express dans la section <strong>Ozon Express</strong>.</span>
            </div>
          ) : (
            <>
              {/* Single tracking lookup */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Rechercher un colis par tracking</label>
                <div className="flex gap-2">
                  <input
                    value={ozoneTrackInput}
                    onChange={e => setOzoneTrackInput(e.target.value)}
                    placeholder="Numéro de tracking Ozone..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                    onKeyDown={e => { if (e.key === 'Enter') document.getElementById('btn-ozone-track')?.click(); }}
                  />
                  <button
                    id="btn-ozone-track"
                    disabled={!ozoneTrackInput.trim() || ozoneTrackLoading}
                    onClick={async () => {
                      setOzoneTrackLoading(true);
                      setOzoneTrackResult(null);
                      const base = `https://api.ozonexpress.ma/customers/${auzone.customerId}/${auzone.apiKey}`;
                      const tn = ozoneTrackInput.trim();
                      try {
                        const trackBody = new FormData();
                        trackBody.append('tracking-number', tn);
                        const infoBody = new FormData();
                        infoBody.append('tracking-number', tn);
                        const [trackRes, infoRes] = await Promise.all([
                          fetch(`${base}/tracking`, { method: 'POST', body: trackBody }),
                          fetch(`${base}/parcel-info`, { method: 'POST', body: infoBody }),
                        ]);
                        const trackJson = trackRes.ok ? await trackRes.json() : null;
                        const infoJson = infoRes.ok ? await infoRes.json() : null;

                        const trackData = trackJson?.['TRACKING'] || trackJson || {};
                        const parcelRaw = infoJson?.['PARCEL-INFO'] || infoJson || {};
                        const parcelInfos = parcelRaw['INFOS'] || parcelRaw;

                        const trackError = (trackData['RESULT'] || '').toUpperCase() === 'ERROR';
                        const parcelError = (parcelRaw['RESULT'] || '').toUpperCase() === 'ERROR';

                        if (trackError && parcelError) {
                          setOzoneTrackResult({ error: parcelRaw['MESSAGE'] || trackData['MESSAGE'] || 'Colis introuvable', history: [], raw: { trackJson, infoJson } });
                        } else {
                          const lastTrack = trackData['LAST_TRACKING'] || trackData['LAST-TRACKING'] || {};
                          const ozStatus = lastTrack['STATUT'] || lastTrack['STATUS'] || parcelInfos['PARCEL-STATUS'] || parcelInfos['STATUS'] || trackData['STATUT'] || '';

                          const histRaw = trackData['HISTORY'] || trackData['PARCEL-HISTORY'] || trackData['history'] || {};
                          const histList = Array.isArray(histRaw) ? histRaw : Object.values(histRaw);

                          setOzoneTrackResult({
                            status: ozStatus,
                            tracking: parcelInfos['TRACKING-NUMBER'] || trackData['TRACKING-NUMBER'] || tn,
                            recipient: parcelInfos['RECEIVER'] || parcelInfos['RECIPIENT-NAME'] || '',
                            city: parcelInfos['CITY_NAME'] || parcelInfos['CITY'] || '',
                            phone: parcelInfos['PHONE'] || parcelInfos['RECIPIENT-PHONE'] || '',
                            price: parcelInfos['PRICE'] || parcelInfos['COD'] || '',
                            deliveryFee: parcelInfos['DELIVERED-PRICE'] || '',
                            history: histList,
                            raw: { trackJson, infoJson },
                            error: null,
                          });
                        }
                      } catch (err) {
                        setOzoneTrackResult({ error: 'Erreur réseau: ' + err.message, history: [], raw: null });
                      }
                      setOzoneTrackLoading(false);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 disabled:opacity-40 transition"
                  >
                    {ozoneTrackLoading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                    Chercher
                  </button>
                </div>
              </div>

              {/* Track result */}
              {ozoneTrackResult && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  {ozoneTrackResult.error ? (
                    <div className="px-4 py-3 bg-red-50">
                      <p className="text-red-600 text-xs flex items-center gap-2 mb-2"><XCircle size={14} /> {ozoneTrackResult.error}</p>
                      {ozoneTrackResult.raw && (
                        <details className="mt-1">
                          <summary className="text-[10px] text-gray-400 cursor-pointer">Réponse API brute</summary>
                          <pre className="text-[10px] text-gray-500 mt-1 overflow-x-auto max-h-32 bg-white rounded p-2">{JSON.stringify(ozoneTrackResult.raw, null, 2)}</pre>
                        </details>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="px-4 py-3 bg-teal-50 border-b border-teal-100">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-gray-500">Tracking: {ozoneTrackResult.tracking}</span>
                          {ozoneTrackResult.status && <span className="text-xs font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full">{ozoneTrackResult.status}</span>}
                        </div>
                        {ozoneTrackResult.recipient && <p className="text-sm font-semibold text-gray-800">{ozoneTrackResult.recipient}</p>}
                        <div className="flex gap-3 mt-1 text-xs text-gray-500">
                          {ozoneTrackResult.city && <span>{ozoneTrackResult.city}</span>}
                          {ozoneTrackResult.phone && <span>{ozoneTrackResult.phone}</span>}
                          {ozoneTrackResult.price && <span className="font-semibold text-gray-700">{ozoneTrackResult.price} DH</span>}
                        </div>
                      </div>
                      {ozoneTrackResult.history.length > 0 && (
                        <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
                          {ozoneTrackResult.history.map((h, i) => (
                            <div key={i} className="px-4 py-2 flex items-start gap-3 text-xs">
                              <span className="mt-1 w-2 h-2 rounded-full bg-teal-400 shrink-0" />
                              <div>
                                <span className="font-semibold text-gray-700">{h.STATUT || h.STATUS || h.status || h.label || ''}</span>
                                {(h.TIME_STR || h.DATE || h.date || h.created_at) && (
                                  <span className="ml-2 text-gray-400">{h.TIME_STR || h.DATE || h.date || h.created_at}</span>
                                )}
                                {h.COMMENT && (
                                  <span className="ml-2 text-gray-400">— {h.COMMENT}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {ozoneTrackResult.raw && (
                        <div className="px-4 py-2 border-t border-gray-100">
                          <details>
                            <summary className="text-[10px] text-gray-400 cursor-pointer">Réponse API brute</summary>
                            <pre className="text-[10px] text-gray-500 mt-1 overflow-x-auto max-h-40 bg-gray-50 rounded p-2">{JSON.stringify(ozoneTrackResult.raw, null, 2)}</pre>
                          </details>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Separator */}
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-bold text-gray-700 mb-1">Sync tous les colis validés</h4>
                <p className="text-xs text-gray-500 mb-3">Met à jour automatiquement les statuts de tous vos colis validés depuis Ozone Express.</p>
                <button
                  onClick={async () => {
                    if (!auzone.customerId || !auzone.apiKey) return;
                    setOzoneSyncState({ status: 'loading', message: 'Synchronisation en cours...', count: 0 });
                    try {
                      const base = `https://api.ozonexpress.ma/customers/${auzone.customerId}/${auzone.apiKey}`;
                      const validatedOrders = orders.filter(o => o.validated);
                      let updated = 0;
                      const statusMap = {
                        'En attente de ramassage': 'att_ramassage',
                        'Ramassé': 'ramasse', 'Ramasse': 'ramasse',
                        'Expédié': 'expedier', 'Expedie': 'expedier',
                        'Reçu par le livreur': 'recu_livreur', 'Recu par le livreur': 'recu_livreur',
                        'Livré': 'livre', 'Livre': 'livre',
                        'Refusé': 'refuse', 'Refuse': 'refuse',
                        'Annulé': 'annule', 'Annule': 'annule',
                        'Échange': 'change', 'Echange': 'change',
                        'En cours de livraison': 'expedier',
                        'Prêt pour retour': 'pret_retour', 'Pret pour retour': 'pret_retour',
                        'Pas de réponse': 'pas_rep_lv', 'Pas de reponse': 'pas_rep_lv',
                        'Injoignable': 'injoignable',
                        'Mise en distribution': 'expedier',
                        'Attente De Ramassage': 'att_ramassage', 'Attente de ramassage': 'att_ramassage',
                        'Reporté': 'reporte', 'Reporte': 'reporte',
                      };
                      for (let i = 0; i < validatedOrders.length; i++) {
                        const o = validatedOrders[i];
                        const tn = o.ozoneTracking || o.trackingNumber || o.id;
                        setOzoneSyncState(p => ({ ...p, message: `${i + 1}/${validatedOrders.length}: ${tn}` }));
                        try {
                          const trackBody = new FormData();
                          trackBody.append('tracking-number', tn);
                          const infoBody = new FormData();
                          infoBody.append('tracking-number', tn);
                          const [trackRes, infoRes] = await Promise.all([
                            fetch(`${base}/tracking`, { method: 'POST', body: trackBody }),
                            fetch(`${base}/parcel-info`, { method: 'POST', body: infoBody }),
                          ]);
                          const trackJson = trackRes.ok ? await trackRes.json() : null;
                          const infoJson = infoRes.ok ? await infoRes.json() : null;
                          const track = trackJson?.['TRACKING'] || trackJson || {};
                          const parcel = infoJson?.['PARCEL-INFO'] || infoJson || {};
                          const parcelInfos = parcel['INFOS'] || parcel;
                          const result = (parcel['RESULT'] || '').toUpperCase();
                          const trackResult = (track['RESULT'] || '').toUpperCase();
                          if (result === 'ERROR' && trackResult === 'ERROR') continue;
                          const lastTrack = track['LAST_TRACKING'] || track['LAST-TRACKING'] || {};
                          const ozStatus = lastTrack['STATUT'] || lastTrack['STATUS'] || parcelInfos['PARCEL-STATUS'] || '';
                          const ozTracking = parcelInfos['TRACKING-NUMBER'] || track['TRACKING-NUMBER'] || tn;
                          const mapped = statusMap[ozStatus] || statusMap[ozStatus.trim()];
                          if (mapped && mapped !== o.status) {
                            setOrders(prev => prev.map(ord =>
                              ord.id === o.id ? { ...ord, status: mapped, ozoneTracking: ozTracking } : ord
                            ));
                            updated++;
                          } else if (!o.ozoneTracking && ozTracking !== tn) {
                            setOrders(prev => prev.map(ord =>
                              ord.id === o.id ? { ...ord, ozoneTracking: ozTracking } : ord
                            ));
                          }
                        } catch {}
                      }
                      setOzoneSyncState({ status: 'done', message: `${updated} commande(s) mise(s) à jour`, count: updated });
                    } catch (err) {
                      setOzoneSyncState({ status: 'error', message: err.message, count: 0 });
                    }
                  }}
                  disabled={ozoneSyncState.status === 'loading'}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-medium hover:bg-teal-700 disabled:opacity-60 transition w-full justify-center"
                >
                  {ozoneSyncState.status === 'loading' ? (
                    <><Loader2 size={13} className="animate-spin" /> {ozoneSyncState.message}</>
                  ) : (
                    <><RefreshCw size={13} /> Synchroniser tout</>
                  )}
                </button>
                {ozoneSyncState.status === 'done' && (
                  <p className="text-xs text-green-600 mt-2 flex items-center gap-1"><CheckCircle2 size={12} /> {ozoneSyncState.message}</p>
                )}
                {ozoneSyncState.status === 'error' && (
                  <p className="text-xs text-red-500 mt-2">{ozoneSyncState.message}</p>
                )}
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* ── Phone Colors Modal ── */}
      <Modal open={openModal === 'phone_colors'} onClose={() => setOpenModal(null)}
        title="ألوان الهاتف" icon={<Phone size={18} className="text-purple-600" />}
        iconBg="bg-gradient-to-r from-purple-50 to-white">
        <div className="space-y-5">
          <p className="text-xs text-gray-500">تخصيص ألوان أرقام الهاتف حسب تاريخ العميل.</p>

          <div className="bg-gray-50 rounded-xl p-4 space-y-4">
            <h3 className="text-sm font-bold text-gray-700">🟢 عميل تم التوصيل (مكرر + ليفري)</h3>
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">الخلفية</label>
                <input type="color" value={pc.livreBg} onChange={e => savePhoneColors({ livreBg: e.target.value })} className="w-10 h-8 rounded cursor-pointer border" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">النص</label>
                <input type="color" value={pc.livreText} onChange={e => savePhoneColors({ livreText: e.target.value })} className="w-10 h-8 rounded cursor-pointer border" />
              </div>
              <div className="ml-auto px-3 py-1 rounded text-sm font-bold" style={{ backgroundColor: pc.livreBg, color: pc.livreText }}>0612345678</div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 space-y-4">
            <h3 className="text-sm font-bold text-gray-700">🟡 عميل معروف (مكرر بلا ليفري)</h3>
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">الخلفية</label>
                <input type="color" value={pc.knownBg} onChange={e => savePhoneColors({ knownBg: e.target.value })} className="w-10 h-8 rounded cursor-pointer border" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">النص</label>
                <input type="color" value={pc.knownText} onChange={e => savePhoneColors({ knownText: e.target.value })} className="w-10 h-8 rounded cursor-pointer border" />
              </div>
              <div className="ml-auto px-3 py-1 rounded text-sm font-bold" style={{ backgroundColor: pc.knownBg, color: pc.knownText }}>0612345678</div>
            </div>
          </div>

          <button onClick={() => { savePhoneColors({ livreBg: '#047857', livreText: '#ffffff', knownBg: '#fbbf24', knownText: '#111827' }); }}
            className="text-xs text-blue-600 hover:underline">إرجاع الألوان الافتراضية</button>
        </div>
      </Modal>

      {/* ── WhatsApp Templates Modal ── */}
      <Modal open={openModal === 'wa_templates'} onClose={() => setOpenModal(null)}
        title="رسائل WhatsApp" icon={<MessageCircle size={18} className="text-green-600" />}
        iconBg="bg-gradient-to-r from-green-50 to-white">
        <div className="space-y-4" dir="rtl">
          <p className="text-xs text-gray-500">تخصيص الرسائل التلقائية اللي كتمشي للكليان ملي كتبدل الحالة. تقدر تستعمل المتغيرات هادي:</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {TEMPLATE_VARS.map(v => (
              <span key={v.var} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded font-mono">{v.var} = {v.label}</span>
            ))}
          </div>

          {Object.entries(waTemplates).map(([status, tpl]) => (
            <div key={status} className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-700">{STATUS_LABELS_AR[status] || status}</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs text-gray-500">{tpl.enabled ? 'مفعل' : 'معطل'}</span>
                  <button
                    onClick={() => saveWaTemplate(status, { enabled: !tpl.enabled })}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${tpl.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <span className="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform" style={{ transform: tpl.enabled ? 'translateX(18px)' : 'translateX(2px)' }} />
                  </button>
                </label>
              </div>
              {tpl.enabled && (
                <textarea
                  className="w-full border border-gray-200 rounded-lg p-3 text-sm leading-relaxed resize-none focus:ring-2 focus:ring-green-200 focus:border-green-300"
                  rows={5}
                  value={tpl.message}
                  onChange={e => saveWaTemplate(status, { message: e.target.value })}
                />
              )}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
