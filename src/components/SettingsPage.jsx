import React, { useState, useEffect, useRef } from 'react';
import { cloudGet, cloudSet } from '../lib/cloudSettings';
import { supabase } from '../lib/supabase';
import {
  Settings, Link2, CheckCircle2, XCircle, Loader2,
  Eye, EyeOff, RefreshCw, Save, AlertTriangle,
  ShoppingCart, Truck, X, Clock, Users, UserPlus, Trash2, DatabaseZap, Volume2, Play,
  Search, ArrowDownCircle, Tag, Upload, Bell, Phone, MessageCircle, FileText, TrendingUp,
} from 'lucide-react';
import { requestPermission } from '../hooks/useNotifications';
import { getWaTemplates, saveWaTemplates, STATUS_LABELS_AR, TEMPLATE_VARS } from '../lib/whatsappTemplates';
import { fmtDate } from '../lib/dateUtils';
import { readNextNumber, setNextNumber, peekNextVictId, formatVictId } from '../lib/victId';
import { A_CONFIRMER_STATUSES } from '../data/colisPipeline';
import { getMetaConfig, saveMetaConfig, loadMetaConfigRemote, buildEvent, sendEvents } from '../lib/metaCapi';

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
  const backupInputRef = useRef(null);

  /* ── Sauvegarde complète : commandes + tous les réglages locaux ── */
  function exportBackup() {
    const dump = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      dump[k] = localStorage.getItem(k);
    }
    const data = { _app: 'victoury', _version: 1, _exportedAt: new Date().toISOString(), ordersCount: orders.length, orders, localStorage: dump };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.href = url;
    a.download = `victoury_backup_${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function restoreBackup(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data._app !== 'victoury' || !data.localStorage) {
        alert('Fichier de sauvegarde invalide.');
        return;
      }
      const when = data._exportedAt ? fmtDate(data._exportedAt) : '?';
      if (!window.confirm(`Restaurer les réglages de la sauvegarde du ${when} ?\n(livreurs, produits, factures, frais, configuration)\nLes commandes sur le cloud ne sont pas écrasées.`)) return;
      // ne pas restaurer la liste noire des suppressions (évite de ressusciter/masquer par erreur)
      const skip = new Set(['deleted_order_ids']);
      Object.entries(data.localStorage).forEach(([k, v]) => { if (!skip.has(k) && typeof v === 'string') localStorage.setItem(k, v); });
      alert('Réglages restaurés. L\'application va se recharger.');
      window.location.reload();
    } catch (err) {
      alert('Erreur de lecture du fichier : ' + (err?.message || err));
    }
  }

  const [ozoneSyncState, setOzoneSyncState] = useState({ status: 'idle', message: '', count: 0 });
  const [ozoneTrackInput, setOzoneTrackInput] = useState('');
  const [ozoneTrackResult, setOzoneTrackResult] = useState(null);
  const [ozoneTrackLoading, setOzoneTrackLoading] = useState(false);

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

  /* Message d'erreur COMPRÉHENSIBLE. Un abandon de requête produit côté
     navigateur « signal is aborted without reason », qui n'apprend rien à
     l'utilisateur : on le traduit en cause probable. */
  function wooErrorText(...errs) {
    for (const e of errs) {
      if (!e) continue;
      if (e.name === 'AbortError' || /aborted/i.test(e.message || '')) {
        return 'la boutique n’a pas répondu à temps — le site victoury-maroc.com est trop lent, à voir avec l’hébergeur';
      }
      if (/failed to fetch|networkerror|load failed/i.test(e.message || '')) {
        return 'connexion impossible — vérifiez le réseau, un bloqueur ou le pare-feu';
      }
      if (e.message) return e.message;
    }
    return 'échec de connexion';
  }

  // fetch WooCommerce : timeout 25s + auth query-string (au cas où l'hébergeur
  // supprime l'en-tête Authorization) EN PLUS du header Basic.
  async function wcFetch(path) {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 25000);
    const sep = path.includes('?') ? '&' : '?';
    const url = `${path}${sep}consumer_key=${encodeURIComponent(woo.consumerKey)}&consumer_secret=${encodeURIComponent(woo.consumerSecret)}`;
    try {
      return await fetch(url, {
        signal: ac.signal,
        headers: { 'Authorization': 'Basic ' + btoa(woo.consumerKey + ':' + woo.consumerSecret) },
      });
    } finally { clearTimeout(to); }
  }

  // Récupère les commandes WooCommerce via la fonction serveur (fiable), avec
  // repli sur l'appel direct. Renvoie un tableau de commandes ou lève une erreur.
  async function wcGetOrders(status = 'processing,pending') {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      // Sans limite de temps, un serveur qui ne répond jamais bloquait le bouton
      // « Tester » indéfiniment (aucun repli, aucune erreur affichée).
      const ac = new AbortController();
      const to = setTimeout(() => ac.abort(), 15000);
      let r;
      try {
        r = await fetch('/api/woo-orders', {
          method: 'POST',
          signal: ac.signal,
          headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
          body: JSON.stringify({ siteUrl: woo.siteUrl, consumerKey: woo.consumerKey, consumerSecret: woo.consumerSecret, status }),
        });
      } finally { clearTimeout(to); }
      const ct = r.headers.get('content-type') || '';
      if (!r.ok && !ct.includes('json')) {
        throw new Error(`Requête bloquée avant le serveur (HTTP ${r.status}) — vérifiez le pare-feu/la protection Vercel du projet`);
      }
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `API ${r.status}`);
      return j.orders || [];
    } catch (apiErr) {
      // Repli : appel direct via le rewrite Vercel. Si CE chemin échoue aussi,
      // son erreur remontait telle quelle — d'où le « signal is aborted without
      // reason » du navigateur, illisible pour l'utilisateur.
      let res;
      try {
        res = await wcFetch(`/wc-api/wp-json/wc/v3/orders?status=${status}&per_page=50`);
      } catch (directErr) {
        throw new Error(wooErrorText(apiErr, directErr));
      }
      if (!res.ok) throw new Error(`${wooErrorText(apiErr)} (HTTP ${res.status})`);
      return res.json();
    }
  }

  /* Le test interroge UNIQUEMENT la route serveur, sans repli sur l'appel
     direct : c'est ce repli qui masquait la vraie cause derrière un
     « signal is aborted » du navigateur. La route serveur, elle, tourne chez
     Vercel — elle n'est donc pas soumise au réseau local, au bloqueur ou au
     pare-feu de l'appareil, et elle rapporte l'erreur exacte de la boutique. */
  /* « La boutique n'a pas répondu » ne dit pas OÙ ça bloque. Après un échec, on
     sonde séparément le site, l'API de WordPress et la lecture des commandes :
     le premier maillon rouge désigne le vrai coupable. */
  async function diagnoseWoo() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch('/api/woo-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ siteUrl: woo.siteUrl, consumerKey: woo.consumerKey, consumerSecret: woo.consumerSecret, diagnose: true }),
      });
      const j = await r.json().catch(() => ({}));
      setWoo((p) => ({ ...p, testSteps: Array.isArray(j.steps) ? j.steps : [] }));
    } catch {
      setWoo((p) => ({ ...p, testSteps: [] }));
    }
  }

  async function testWoo() {
    if (!woo.siteUrl || !woo.consumerKey || !woo.consumerSecret) return;
    setWoo((p) => ({ ...p, testStatus: 'loading', testError: '', testSteps: null }));
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 30000);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch('/api/woo-orders', {
        method: 'POST',
        signal: ac.signal,
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ siteUrl: woo.siteUrl, consumerKey: woo.consumerKey, consumerSecret: woo.consumerSecret, status: 'any' }),
      });
      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('json')) {
        setWoo((p) => ({
          ...p, testStatus: 'error',
          testError: `réponse non-JSON (HTTP ${r.status}) — la requête est bloquée AVANT le serveur (pare-feu / protection Vercel)`,
        }));
        return;
      }
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setWoo((p) => ({ ...p, testStatus: 'error', testError: `${j.error || 'erreur'} (HTTP ${r.status})` }));
        diagnoseWoo();
        return;
      }
      setWoo((p) => ({ ...p, testStatus: 'success', testError: `${(j.orders || []).length} commande(s) lue(s)` }));
    } catch (e) {
      // La fonction serveur ne répond pas : on vérifie la seconde voie (appel
      // direct via le rewrite), celle qu'utilise réellement la synchronisation.
      // Si elle marche, la boutique est joignable et l'import fonctionnera.
      const cause = e?.name === 'AbortError'
        ? 'la fonction serveur /api/woo-orders ne répond pas'
        : `/api/woo-orders injoignable (${e?.message || 'réseau'})`;
      try {
        const res = await wcFetch('/wc-api/wp-json/wc/v3/orders?status=any&per_page=1');
        if (res.ok) {
          setWoo((p) => ({
            ...p, testStatus: 'success',
            testError: `boutique joignable en direct — ${cause}, la synchronisation utilisera la voie directe`,
          }));
          return;
        }
        setWoo((p) => ({ ...p, testStatus: 'error', testError: `${cause} ; voie directe : HTTP ${res.status}` }));
      } catch (directErr) {
        setWoo((p) => ({ ...p, testStatus: 'error', testError: `${cause} ; voie directe : ${wooErrorText(directErr)}` }));
      }
    } finally { clearTimeout(to); }
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
      const data = await wcGetOrders('processing,pending');
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
          dateAdded: fmtDate(o.date_created), dateUpdated: fmtDate(o.date_modified), validated: false,
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

  /* ── Restauration des codes de suivi depuis Ozon (action MANUELLE) ──
     Ozon détient le code VICT réellement enregistré pour chaque colis. On balaie
     la série VICT0001..VICT0400, on lit le téléphone du destinataire renvoyé par
     Ozon, et on remet ce code sur la commande correspondante. Aucun effacement. */

  const [ozImport, setOzImport] = useState({ running: false, message: '', lines: [] });
  const [nextNum, setNextNum] = useState(() => String(readNextNumber() || ''));
  const [nextNumMsg, setNextNumMsg] = useState('');
  const [renumNouveau, setRenumNouveau] = useState({ running: false, message: '', lines: [] });

  /* ── Numérotation des commandes « À Confirmer » (action MANUELLE) ──
     Repart de 1 et attribue la série VI aux commandes encore à confirmer, dans
     l'ordre d'ajout. Portée volontairement étroite : rien d'autre n'est touché,
     ni la Liste des Colis, ni « En Suivi », ni « Confirmé ». */
  async function renumberNouveau() {
    const TARGET = new Set(A_CONFIRMER_STATUSES);
    setRenumNouveau({ running: true, message: 'Lecture des commandes…', lines: [] });
    try {
      let rows = [];
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase.from('orders')
          .select('id, tracking_number, recipient, status, validated, date_added')
          .or('is_deleted.is.null,is_deleted.eq.false')
          .order('id', { ascending: true }).range(from, from + PAGE - 1);
        if (error) { setRenumNouveau({ running: false, message: 'Lecture impossible : ' + error.message, lines: [] }); return; }
        const b = data || [];
        rows = rows.concat(b);
        if (b.length < PAGE) break;
      }

      const ts = (v) => {
        const m = String(v || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
        return m ? new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime() : 0;
      };
      const targets = rows
        .filter(r => TARGET.has(r.status) && !r.validated)
        .sort((a, b) => ts(a.date_added) - ts(b.date_added));

      if (!targets.length) {
        setRenumNouveau({ running: false, message: 'Aucune commande à numéroter.', lines: [] });
        return;
      }

      // Numéros VI portés par les AUTRES commandes : on les saute pour ne créer
      // aucun doublon, même si elles ne servent pas au calcul de la série.
      const targetIds = new Set(targets.map(r => r.id));
      const taken = new Set();
      for (const r of rows) {
        if (targetIds.has(r.id)) continue;
        for (const v of [r.id, r.tracking_number]) {
          const m = /^VI(\d+)$/i.exec(String(v || '').trim());
          if (m) taken.add(parseInt(m[1], 10));
        }
      }

      let n = 0;
      const nextFree = () => { do { n += 1; } while (taken.has(n)); taken.add(n); return formatVictId(n); };

      const updates = [];
      for (const r of targets) {
        const code = nextFree();
        if (String(r.tracking_number || '').toUpperCase() === code.toUpperCase()) continue;
        updates.push({ id: r.id, code, from: r.tracking_number || r.id, name: r.recipient?.name || r.id });
      }

      if (!updates.length) {
        setRenumNouveau({ running: false, message: `✅ Les ${targets.length} commandes sont déjà numérotées.`, lines: [] });
        return;
      }

      setRenumNouveau({ running: true, message: `Numérotation de ${updates.length} commande(s)…`, lines: [] });
      let failed = 0;
      const okIds = new Map();
      const B = 20;
      for (let i = 0; i < updates.length; i += B) {
        await Promise.all(updates.slice(i, i + B).map(({ id, code }) =>
          supabase.from('orders').update({ tracking_number: code, date_updated: stampNow() }).eq('id', id)
            .then(({ error }) => { if (error) failed++; else okIds.set(id, code); })
            .catch(() => { failed++; })
        ));
      }

      // Relecture : on n'applique en local que ce qui est réellement enregistré.
      const ids = [...okIds.keys()];
      const persisted = new Map();
      for (let i = 0; i < ids.length; i += 100) {
        const { data } = await supabase.from('orders').select('id, tracking_number').in('id', ids.slice(i, i + 100));
        for (const row of (data || [])) persisted.set(row.id, row.tracking_number);
      }
      const applied = new Map([...okIds].filter(([id, code]) => persisted.get(id) === code));

      const stamped = stampNow();
      setOrders(prev => prev.map(o => applied.has(o.id)
        ? { ...o, trackingNumber: applied.get(o.id), dateUpdated: stamped }
        : o));

      // La série repart après le dernier numéro attribué.
      setNextNumber(n + 1);
      setNextNum(String(n + 1));

      // Des instantanés périmés réécriraient les codes qu'on vient d'attribuer.
      try { const { clearSyncQueue } = await import('../lib/offlineStore'); await clearSyncQueue(); } catch {}

      setRenumNouveau({
        running: false,
        message: `✅ ${applied.size} commande(s) numérotée(s)${failed ? ` — ⚠️ ${failed} échec(s)` : ''}. Rechargement…`,
        lines: updates.filter(u => applied.has(u.id)).slice(0, 30).map(u => `  ${u.from} → ${u.code} : ${u.name}`),
      });
      if (applied.size) setTimeout(() => window.location.reload(), 3000);
    } catch (e) {
      setRenumNouveau({ running: false, message: 'Erreur : ' + (e?.message || 'échec'), lines: [] });
    }
  }

  /* ── Import des codes de suivi réels depuis Ozon (action MANUELLE) ──
     Ozon est la source de vérité : c'est lui qui connaît le code sous lequel
     chaque colis circule. On récupère son inventaire page par page, on
     reconstitue la correspondance téléphone → code, puis on aligne les
     commandes dessus.
     Interroger Ozon commande par commande était impraticable : chaque appel
     rouvre une session sur le tableau de bord. */
  async function importOzonCodes() {
    setOzImport({ running: true, message: 'Lecture des colis chez Ozon…', lines: [] });
    const digits = (v) => {
      const raw = String(v || '').replace(/\D/g, '').replace(/^00/, '').replace(/^212/, '');
      const nine = raw.slice(-9);
      return nine.length === 9 ? '0' + nine : '';
    };
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const auth = session?.access_token ? { headers: { Authorization: `Bearer ${session.access_token}` } } : undefined;

      /* Une page peut échouer pour un aléa réseau alors que l'inventaire compte
         des dizaines de pages : sans reprise, tout l'import est perdu. On
         réessaie, puis on nomme la cause au lieu du « Failed to fetch » brut. */
      const fetchPage = async (url) => {
        let lastErr;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            return await fetch(url, auth);
          } catch (e) {
            lastErr = e;
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          }
        }
        throw new Error(
          /failed to fetch|networkerror|load failed/i.test(lastErr?.message || '')
            ? "connexion impossible — vérifiez le réseau, un bloqueur de publicités ou le pare-feu"
            : (lastErr?.message || 'réseau')
        );
      };

      // 1) Inventaire Ozon, page par page.
      const PAGE = 100;
      const byPhone = new Map();      // téléphone -> code (unique)
      const multi = new Set();        // téléphones portant plusieurs colis
      let start = 0, total = null, seen = 0;
      for (let guard = 0; guard < 200; guard++) {
        const r = await fetchPage(`/api/ozone-status?list=1&start=${start}&length=${PAGE}`);
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          setOzImport({ running: false, message: `Lecture Ozon impossible : ${j.error || r.status}`, lines: [] });
          return;
        }
        const d = await r.json();
        const parcels = d.parcels || [];
        if (total === null) total = d.total;
        for (const p of parcels) {
          const ph = digits(p.phone);
          if (!ph || !p.code) continue;
          if (byPhone.has(ph) && byPhone.get(ph) !== p.code) multi.add(ph);
          else byPhone.set(ph, p.code);
        }
        seen += parcels.length;
        setOzImport({ running: true, message: `Lecture des colis chez Ozon… ${seen}${total ? '/' + total : ''}`, lines: [] });
        if (parcels.length < PAGE) break;
        start += PAGE;
        if (total !== null && start >= total) break;
      }
      for (const ph of multi) byPhone.delete(ph);

      if (!byPhone.size) {
        setOzImport({ running: false, message: 'Aucun colis exploitable trouvé chez Ozon.', lines: [] });
        return;
      }

      // 2) Commandes de la base.
      setOzImport({ running: true, message: `${byPhone.size} colis lus — lecture des commandes…`, lines: [] });
      let rows = [];
      const DB = 1000;
      for (let from = 0; ; from += DB) {
        const { data, error } = await supabase.from('orders')
          .select('id, tracking_number, recipient')
          .or('is_deleted.is.null,is_deleted.eq.false')
          .order('id', { ascending: true }).range(from, from + DB - 1);
        if (error) { setOzImport({ running: false, message: 'Lecture des commandes impossible : ' + error.message, lines: [] }); return; }
        const b = data || [];
        rows = rows.concat(b);
        if (b.length < DB) break;
      }

      // 3) Alignement : seules les différences sont écrites.
      const updates = [];
      const ambiguous = [];
      const noParcel = [];   // commandes sans colis correspondant chez Ozon
      for (const r of rows) {
        const ph = digits(r.recipient?.phone);
        if (!ph) continue;
        if (multi.has(ph)) { ambiguous.push(`${r.tracking_number || r.id} : ${r.recipient?.name || r.id} — ${ph}`); continue; }
        const code = byPhone.get(ph);
        if (!code) {
          // Signalé UNIQUEMENT pour les commandes censées être chez Ozon : sinon
          // la liste contiendrait toutes les commandes jamais expédiées.
          if (/ozon/i.test(r.recipient?.delivery || '')) {
            noParcel.push(`${r.tracking_number || r.id} : ${r.recipient?.name || r.id} — ${ph}`);
          }
          continue;
        }
        if (String(r.tracking_number || '').toUpperCase() === code.toUpperCase()) continue;
        updates.push({ id: r.id, code, from: r.tracking_number || r.id, name: r.recipient?.name || r.id });
      }
      const noParcelLines = noParcel.length
        ? [`Aucun colis chez Ozon pour ces ${noParcel.length} commande(s) — rien à importer :`,
           ...noParcel.slice(0, 15).map(l => '  ' + l)]
        : [];

      if (!updates.length) {
        setOzImport({
          running: false,
          message: `✅ Tout est déjà aligné sur Ozon (${byPhone.size} colis lus).`,
          lines: [
            ...(ambiguous.length ? ['Ignorés (plusieurs colis pour le même numéro) :', ...ambiguous.slice(0, 15).map(l => '  ' + l)] : []),
            ...noParcelLines,
          ],
        });
        return;
      }

      setOzImport({ running: true, message: `Écriture de ${updates.length} code(s)…`, lines: [] });
      let failed = 0;
      const okIds = new Map();
      const B = 20;
      for (let i = 0; i < updates.length; i += B) {
        await Promise.all(updates.slice(i, i + B).map(({ id, code }) =>
          supabase.from('orders').update({ tracking_number: code, ozone_tracking: code, date_updated: stampNow() }).eq('id', id)
            .then(({ error }) => { if (error) failed++; else okIds.set(id, code); })
            .catch(() => { failed++; })
        ));
      }

      // Relecture : on n'applique en local que ce qui est réellement enregistré.
      const ids = [...okIds.keys()];
      const persisted = new Map();
      for (let i = 0; i < ids.length; i += 100) {
        const { data } = await supabase.from('orders').select('id, tracking_number').in('id', ids.slice(i, i + 100));
        for (const row of (data || [])) persisted.set(row.id, row.tracking_number);
      }
      const applied = new Map([...okIds].filter(([id, code]) => persisted.get(id) === code));

      // Le livreur mémorisé appartenait à l'ancien code.
      for (const id of applied.keys()) { try { localStorage.removeItem(`ozone_dp_${id}`); } catch {} }
      const stamped = stampNow();
      setOrders(prev => prev.map(o => applied.has(o.id)
        ? { ...o, trackingNumber: applied.get(o.id), ozoneTracking: applied.get(o.id), dateUpdated: stamped }
        : o));

      // Des instantanés périmés réécriraient les codes qu'on vient d'aligner.
      try { const { clearSyncQueue } = await import('../lib/offlineStore'); await clearSyncQueue(); } catch {}

      setOzImport({
        running: false,
        message: `✅ ${applied.size} code(s) alignés sur Ozon${failed ? ` — ⚠️ ${failed} échec(s)` : ''}. Rechargement…`,
        lines: [
          ...updates.filter(u => applied.has(u.id)).slice(0, 30).map(u => `  ${u.from} → ${u.code} : ${u.name}`),
          ...(ambiguous.length ? ['Ignorés (plusieurs colis pour le même numéro) :', ...ambiguous.slice(0, 15).map(l => '  ' + l)] : []),
          ...noParcelLines,
        ],
      });
      if (applied.size) setTimeout(() => window.location.reload(), 3000);
    } catch (e) {
      setOzImport({ running: false, message: 'Erreur : ' + (e?.message || 'échec'), lines: [] });
    }
  }

  /* Horodatage au format de l'application. Indispensable sur toute correction de
     code : sans nouvelle date de mise à jour, la file de synchronisation croit que
     son ancien instantané est encore valable et réécrit l'ancien code. */
  const stampNow = () => new Date().toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).replace(',', '');

  /* ── Correction des codes de suivi EN DOUBLE ──
     Pour chaque code partagé par plusieurs commandes : on demande à Ozon à qui
     appartient réellement ce code (téléphone du destinataire). Cette commande le
     GARDE ; les autres reçoivent un nouveau numéro libre. Si Ozon ne connaît pas
     le code, la commande la plus ANCIENNE le garde. Les codes « MIMA » sont exclus. */


  /* ── Renumérotation VICTOURY des onglets « À Confirmer » et « En Suivi » ──
     Action MANUELLE et ponctuelle : les commandes encore en cours de traitement
     (donc PAS remises au transporteur) reçoivent les plus petits numéros
     VICTOURY libres, dans l'ordre chronologique.
     Jamais touché : les colis déjà validés/expédiés (leur code est connu du
     transporteur), les codes contenant « MIMA », et tout numéro VICTOURY déjà
     porté par une autre commande (aucun doublon créé). */

  /* ── Restauration des codes VICT écrasés par un code VICTOURY ──
     Lors du passage à la nouvelle série, des commandes DÉJÀ confirmées (donc
     déjà déclarées chez Ozon sous leur code VICTxxxx) ont pu recevoir un code
     VICTOURY. Leur code Ozon d'origine est toujours en base dans la colonne
     `ozone_tracking` : on le remet comme code de suivi.
     Aucune commande dont `ozone_tracking` est vide n'est touchée. */

  /* ── Meta / Conversions API ── */
  const [meta, setMeta] = useState(() => ({ enabled: false, pixelId: '', token: '', testCode: '', sourceUrl: '', ...getMetaConfig() }));
  const [metaTest, setMetaTest] = useState(null);
  /* Le réglage est attaché au compte : sur un appareil où il n'a jamais été
     saisi, les champs restaient vides et l'envoi ne partait pas. */
  useEffect(() => {
    let vivant = true;
    loadMetaConfigRemote().then(remote => { if (vivant && remote) setMeta(prev => ({ ...prev, ...remote })); }).catch(() => {});
    return () => { vivant = false; };
  }, []);
  function updateMeta(patch) {
    setMeta(prev => ({ ...prev, ...saveMetaConfig({ ...prev, ...patch }) }));
    setMetaTest(null);
  }
  async function testMeta() {
    setMetaTest({ busy: true });
    try {
      /* Envoi d'une commande RÉELLE déjà livrée plutôt qu'un évènement inventé :
         un test factice passe même quand les vraies données ne conviennent pas
         (numéro absent, montant nul). */
      const sample = (orders || []).find(o => o.status === 'livre' && o.recipient?.phone);
      if (!sample) { setMetaTest({ ok: false, msg: 'Aucune commande livrée avec téléphone pour tester' }); return; }
      const ev = await buildEvent(sample, meta);
      const { data: { session } } = await supabase.auth.getSession();
      const r = await sendEvents([ev], meta, session?.access_token);
      setMetaTest(r.ok
        ? { ok: true, msg: `Évènement accepté par Meta (commande ${sample.id})` }
        : { ok: false, msg: r.error });
    } catch (e) {
      setMetaTest({ ok: false, msg: e?.message || 'Échec' });
    }
  }

  /* ── Settings cards config ── */
  const CARDS = [
    {
      // Carte dédiée : la numérotation était enfouie dans la fenêtre « Ozon
      // Express », où personne ne va la chercher.
      id: 'tracking',
      title: 'Codes de suivi',
      desc: 'Série des numéros de commande : prochain numéro et numérotation des commandes à confirmer.',
      icon: <FileText size={22} className="text-amber-600" />,
      iconBg: 'bg-amber-100',
      cardBg: 'from-amber-50',
      saved: true,
      badge: { label: peekNextVictId(orders), color: 'text-amber-700 bg-amber-50 border-amber-200' },
    },
    {
      /* La publicité n'apprend, depuis le site, que la commande PASSÉE. En
         paiement à la livraison, une bonne part n'aboutit jamais. */
      id: 'meta',
      title: 'Meta / Facebook',
      desc: 'Renvoie à Meta les commandes réellement livrées, pour que la publicité optimise sur les ventes encaissées.',
      icon: <TrendingUp size={22} className="text-blue-600" />,
      iconBg: 'bg-blue-100',
      cardBg: 'from-blue-50',
      saved: !!(meta.enabled && meta.pixelId && meta.token),
      badge: meta.enabled && meta.pixelId && meta.token
        ? { label: 'Actif', color: 'text-green-700 bg-green-50 border-green-200' }
        : { label: 'Inactif', color: 'text-gray-500 bg-gray-50 border-gray-200' },
    },
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
        {/* Version réellement chargée par CET appareil : permet de distinguer
            « le correctif ne marche pas » de « le navigateur sert l'ancien cache ». */}
        <span className="ml-auto text-[10px] font-mono text-gray-400" title="Version chargée sur cet appareil">
          v{typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : '?'}
        </span>
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
              const remote = await cloudGet('deleted_order_ids');
              const local = JSON.parse(localStorage.getItem('deleted_order_ids') || '[]');
              const merged = [...new Set([...(Array.isArray(remote) ? remote : []), ...local])];
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
              const delRemote = await cloudGet('deleted_order_ids');
              if (Array.isArray(delRemote)) localStorage.setItem('deleted_order_ids', JSON.stringify(delRemote));
              /* Purge TOTALE du Service Worker + caches : c'est lui qui sert
                 l'ancienne version et peut faire échouer /api & /wc-api. */
              try {
                if ('serviceWorker' in navigator) {
                  const regs = await navigator.serviceWorker.getRegistrations();
                  await Promise.all(regs.map(r => r.unregister()));
                }
                if ('caches' in window) {
                  const names = await caches.keys();
                  await Promise.all(names.map(n => caches.delete(n)));
                }
              } catch {}
              window.location.reload(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition"
          >
            <Trash2 size={12} /> Réinitialiser le cache
          </button>
          {/* Mise à jour FORCÉE : ne touche à aucune donnée, se contente de
              désinstaller le Service Worker et de vider les caches de fichiers.
              À utiliser quand l'appareil continue d'afficher une ancienne
              version malgré les rechargements. */}
          <button
            onClick={async () => {
              if (!window.confirm("Forcer la mise à jour de l'application ?\n\nAucune donnée n'est supprimée : seuls les fichiers mis en cache sont rechargés depuis le serveur.")) return;
              try {
                if ('serviceWorker' in navigator) {
                  const regs = await navigator.serviceWorker.getRegistrations();
                  await Promise.all(regs.map(r => r.unregister()));
                }
                if ('caches' in window) {
                  const names = await caches.keys();
                  await Promise.all(names.map(n => caches.delete(n)));
                }
              } catch {}
              // `reload(true)` est ignoré par les navigateurs modernes : on force
              // une URL différente pour court-circuiter tout cache de navigation.
              const u = new URL(window.location.href);
              u.searchParams.set('maj', Date.now().toString(36));
              window.location.replace(u.toString());
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition"
          >
            <RefreshCw size={12} /> Forcer la mise à jour
          </button>
        </div>
      </div>


      {/* Sauvegarde & Restauration */}
      <div className="mb-5 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-green-50 to-white px-5 pt-5 pb-4">
          <div className="inline-flex p-2.5 rounded-xl bg-green-100 mb-3"><Save size={22} className="text-green-600" /></div>
          <h3 className="font-bold text-gray-800 text-base">Sauvegarde &amp; Restauration</h3>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">Exportez toutes vos données (commandes, factures, produits, livreurs, frais, réglages) dans un seul fichier à garder en lieu sûr. Sécurité totale contre la perte de données.</p>
        </div>
        <div className="px-5 pb-4 pt-3 border-t border-gray-50 flex flex-wrap gap-2">
          <button
            onClick={exportBackup}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition"
          >
            <Save size={12} /> Télécharger une sauvegarde ({orders.length} commandes)
          </button>
          <button
            onClick={() => backupInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-green-300 text-green-700 hover:bg-green-50 text-xs font-semibold rounded-lg transition"
          >
            <Upload size={12} /> Restaurer les réglages
          </button>
          <input ref={backupInputRef} type="file" accept=".json,application/json" className="hidden" onChange={restoreBackup} />
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
            {woo.testStatus === 'error' && <span className="flex items-center gap-1 text-xs text-red-600"><XCircle size={12} /> Échec{woo.testError ? ` — ${woo.testError}` : ''}</span>}
            {woo.syncStatus === 'success' && <span className="flex items-center gap-1 text-xs text-purple-600"><CheckCircle2 size={12} /> Importées</span>}
          </div>

          {/* Diagnostic : le premier maillon en rouge indique ce qu'il faut réparer. */}
          {Array.isArray(woo.testSteps) && woo.testSteps.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm text-xs">
              {woo.testSteps.map((s, i) => (
                <div key={s.name} className={`flex items-center justify-between gap-2 px-3 py-2 ${i % 2 ? 'bg-gray-50' : 'bg-white'}`}>
                  <span className="flex items-center gap-1.5">
                    {s.ok ? <CheckCircle2 size={12} className="text-green-600" /> : <XCircle size={12} className="text-red-600" />}
                    {s.name}
                  </span>
                  <span className={s.ok ? 'text-gray-500' : 'text-red-600'}>
                    {s.error || `HTTP ${s.status}`} · {s.ms} ms
                  </span>
                </div>
              ))}
              <div className="px-3 py-2 bg-amber-50 text-amber-700 border-t border-amber-200">
                Le premier élément en rouge indique où ça bloque. Si le site lui-même est
                rouge ou lent, c’est l’hébergement du site qu’il faut revoir.
              </div>
            </div>
          )}
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
      {/* ── Codes de suivi ── */}
      {/* ── Meta / Conversions API ── */}
      <Modal open={openModal === 'meta'} onClose={() => setOpenModal(null)}
        title="Meta / Facebook" icon={<TrendingUp size={18} className="text-blue-600" />}>
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 text-xs text-blue-800 leading-relaxed">
            Meta n’apprend, depuis le site, que la commande <b>passée</b>. Ici, le système lui
            renvoie l’issue <b>réelle</b> : livrée, annulée, refusée — pour que la publicité
            cherche des clients qui paient, et non des formulaires remplis.
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input type="checkbox" checked={!!meta.enabled} onChange={e => updateMeta({ enabled: e.target.checked })} />
            Activer l’envoi automatique
          </label>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Pixel ID</label>
            <input type="text" value={meta.pixelId || ''} onChange={e => updateMeta({ pixelId: e.target.value })}
              placeholder="1080161523515714"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Jeton d’accès (Gestionnaire d’évènements → Paramètres → API de conversions)
            </label>
            <input type="password" value={meta.token || ''} onChange={e => updateMeta({ token: e.target.value })}
              placeholder="EAAG..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Code de test (facultatif — pour voir les évènements arriver en direct)
            </label>
            <input type="text" value={meta.testCode || ''} onChange={e => updateMeta({ testCode: e.target.value })}
              placeholder="TEST12345"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Adresse de la boutique (facultatif)</label>
            <input type="text" value={meta.sourceUrl || ''} onChange={e => updateMeta({ sourceUrl: e.target.value })}
              placeholder="https://victoury-maroc.com"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={testMeta} disabled={!meta.pixelId || !meta.token || metaTest?.busy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-300 text-blue-600 text-xs font-medium hover:bg-blue-50 disabled:opacity-40 transition">
              {metaTest?.busy ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
              Tester l’envoi
            </button>
            {metaTest && !metaTest.busy && (
              <span className={`flex items-center gap-1 text-xs ${metaTest.ok ? 'text-green-600' : 'text-red-600'}`}>
                {metaTest.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />} {metaTest.msg}
              </span>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-[11px] text-amber-800 leading-relaxed">
            Le téléphone et le nom sont <b>hachés dans le navigateur</b> : ni ce serveur ni Meta ne
            voient une donnée en clair. Comptez une à deux semaines avant que l’effet se voie —
            Meta a besoin d’un volume d’évènements pour réapprendre.
          </div>
        </div>
      </Modal>

      <Modal open={openModal === 'tracking'} onClose={() => setOpenModal(null)}
        title="Codes de suivi" icon={<FileText size={18} className="text-amber-600" />}>
        <div className="space-y-4">
          {/* Point de départ de la série */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-700">Prochain numéro de la série</p>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              <span className="block mb-1 text-gray-800 font-semibold">
                Prochaine commande : {peekNextVictId(orders)}
              </span>
              Laissez vide pour que l'application continue après le plus grand numéro
              existant — un ancien code erroné resté dans un onglet suffit alors à faire
              sauter la série. Indiquez un numéro pour fixer la suite vous-même.
              <strong className="text-gray-700"> Un numéro déjà utilisé est automatiquement sauté</strong> :
              aucun doublon n'est possible.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-mono">VI</span>
              <input
                type="number" min="1" value={nextNum}
                onChange={(e) => { setNextNum(e.target.value); setNextNumMsg(''); }}
                placeholder="auto"
                className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <button
                onClick={() => {
                  const v = parseInt(nextNum, 10);
                  if (!nextNum.trim()) {
                    try { localStorage.removeItem('victoury_next_number'); } catch {}
                    cloudSet('victoury_next_number', 0);
                    setNextNumMsg('✅ Automatique : la série suit le plus grand numéro existant.');
                    return;
                  }
                  if (!Number.isFinite(v) || v < 1) { setNextNumMsg('Numéro invalide.'); return; }
                  const saved = setNextNumber(v);
                  setNextNum(String(saved));
                  setNextNumMsg(`✅ La prochaine commande recevra ${formatVictId(saved)}.`);
                }}
                className="px-4 py-2 rounded-lg bg-gray-800 text-white text-xs font-medium hover:bg-gray-900 transition">
                Enregistrer
              </button>
              {nextNumMsg && <span className="text-xs text-gray-600">{nextNumMsg}</span>}
            </div>
          </div>

          {/* Numérotation des commandes À Confirmer */}
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <p className="text-xs font-semibold text-gray-700">Numéroter les commandes « À Confirmer »</p>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Repart de <strong>VI00001</strong> et numérote, dans l'ordre d'ajout, les commandes
              encore à confirmer. La série continue ensuite toute seule.
              <strong className="text-gray-700"> Rien d'autre n'est touché</strong> : ni la Liste des
              Colis, ni « En Suivi », ni « Confirmé » — leurs codes restent tels quels et leurs
              numéros sont simplement sautés pour éviter tout doublon.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (window.confirm(
                    "Numéroter les commandes « À Confirmer » à partir de VI00001 ?\n\n"
                    + "• Seules les commandes À Confirmer sont modifiées\n"
                    + "• Liste des Colis, En Suivi et Confirmé ne sont PAS touchés\n\n"
                    + "Fermez l'application sur les autres appareils avant de continuer."
                  )) renumberNouveau();
                }}
                disabled={renumNouveau.running}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 disabled:opacity-40 transition">
                {renumNouveau.running ? 'Numérotation…' : 'Numéroter à partir de VI00001'}
              </button>
              {renumNouveau.message && <span className="text-xs text-gray-600">{renumNouveau.message}</span>}
            </div>
            {renumNouveau.lines?.length > 0 && (
              <pre className="text-[10px] bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                {renumNouveau.lines.join('\n')}
              </pre>
            )}
          </div>

        </div>
      </Modal>

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

          {/* Import des codes de suivi réels depuis Ozon */}
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <p className="text-xs font-semibold text-gray-700">Importer les codes de suivi depuis Ozon</p>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Récupère la liste des colis chez Ozon et remet, sur chaque commande, le code
              d'envoi <strong>réellement enregistré chez le transporteur</strong> (correspondance
              par téléphone). Ozon fait foi : c'est son code qui est écrit dans l'application.
              <strong className="text-gray-700"> Un numéro portant plusieurs colis chez Ozon est ignoré</strong> (impossible
              de savoir lequel correspond) et signalé dans le rapport.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (window.confirm(
                    "Importer les codes de suivi depuis Ozon ?\n\n"
                    + "Chaque commande reprend le code que le transporteur lui connaît.\n"
                    + "Fermez l'application sur les autres appareils avant de continuer."
                  )) importOzonCodes();
                }}
                disabled={ozImport.running || !auzone.customerId || !auzone.apiKey}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-40 transition">
                {ozImport.running ? 'Import…' : 'Importer les codes depuis Ozon'}
              </button>
              {ozImport.message && <span className="text-xs text-gray-600">{ozImport.message}</span>}
            </div>
            {ozImport.lines?.length > 0 && (
              <pre className="text-[10px] bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                {ozImport.lines.join('\n')}
              </pre>
            )}
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
                        'Ramassé': 'att_ramassage', 'Ramasse': 'att_ramassage',
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
                        'Reporté': 'reporter', 'Reporte': 'reporter',
                      };
                      for (let i = 0; i < validatedOrders.length; i++) {
                        const o = validatedOrders[i];
                        const tn = o.trackingNumber || o.ozoneTracking || o.id;
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
