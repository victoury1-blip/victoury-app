import React, { useState, useEffect, useRef } from 'react';
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
      const when = data._exportedAt ? new Date(data._exportedAt).toLocaleString('fr-MA') : '?';
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
      const r = await fetch('/api/woo-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ siteUrl: woo.siteUrl, consumerKey: woo.consumerKey, consumerSecret: woo.consumerSecret, status }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `API ${r.status}`);
      return j.orders || [];
    } catch (apiErr) {
      const res = await wcFetch(`/wc-api/wp-json/wc/v3/orders?status=${status}&per_page=50`);
      if (!res.ok) throw new Error(apiErr.message || `HTTP ${res.status}`);
      return res.json();
    }
  }

  async function testWoo() {
    if (!woo.siteUrl || !woo.consumerKey || !woo.consumerSecret) return;
    setWoo((p) => ({ ...p, testStatus: 'loading' }));
    try {
      await wcGetOrders('any');
      setWoo((p) => ({ ...p, testStatus: 'success' }));
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

  /* ── Restauration des codes de suivi depuis Ozon (action MANUELLE) ──
     Ozon détient le code VICT réellement enregistré pour chaque colis. On balaie
     la série VICT0001..VICT0400, on lit le téléphone du destinataire renvoyé par
     Ozon, et on remet ce code sur la commande correspondante. Aucun effacement. */
  const [ozonRestore, setOzonRestore] = useState({ running: false, message: '' });

  /* Horodatage au format de l'application. Indispensable sur toute correction de
     code : sans nouvelle date de mise à jour, la file de synchronisation croit que
     son ancien instantané est encore valable et réécrit l'ancien code. */
  const stampNow = () => new Date().toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).replace(',', '');

  async function restoreOzonCodes() {
    const cfg = { customerId: auzone.customerId, apiKey: auzone.apiKey };
    if (!cfg.customerId || !cfg.apiKey) return;
    setOzonRestore({ running: true, message: 'Recherche des colis chez Ozon…' });
    const base = `https://api.ozonexpress.ma/customers/${cfg.customerId}/${cfg.apiKey}`;
    const digits = (s) => String(s || '').replace(/\D/g, '').replace(/^212/, '0');
    // Les codes contenant « MIMA » sont gérés ailleurs : on ne les touche JAMAIS.
    const isProtected = (o) => /mima/i.test(
      `${o.trackingNumber || ''} ${o.ozoneTracking || ''} ${o.id || ''}`
    );
    // Un téléphone peut porter PLUSIEURS commandes (client fidèle, échange…).
    // Dans ce cas on ne peut pas savoir laquelle correspond : on l'IGNORE plutôt
    // que d'écrire le code sur la mauvaise commande.
    const phoneGroups = new Map();
    for (const o of orders || []) {
      if (isProtected(o)) continue;
      const p = digits(o.recipient?.phone);
      if (!p) continue;
      if (!phoneGroups.has(p)) phoneGroups.set(p, []);
      phoneGroups.get(p).push(o);
    }
    const byPhone = new Map();
    let ambiguous = 0;
    for (const [p, list] of phoneGroups) {
      if (list.length === 1) byPhone.set(p, list[0]);
      else ambiguous += list.length;
    }

    const found = [];              // { code, order }
    // Code Ozon -> téléphone du destinataire chez Ozon. Sert à PROUVER qu'un code
    // porté par une commande appartient en réalité à quelqu'un d'autre.
    const codePhone = new Map();
    const MAX = 400, CONC = 10;
    try {
      for (let start = 1; start <= MAX; start += CONC) {
        const batch = [];
        for (let i = start; i < start + CONC && i <= MAX; i++) batch.push(i);
        await Promise.all(batch.map(async (n) => {
          // Chez Ozon, le même numéro existe sous plusieurs longueurs de
          // remplissage (VICT0050 créé par l'app, VICT00050 saisi sur le tableau
          // de bord). En ne testant que 4 chiffres, on ratait le vrai colis et la
          // commande héritait du code — donc du livreur — de quelqu'un d'autre.
          const variants = [...new Set([
            'VICT' + String(n).padStart(4, '0'),
            'VICT' + String(n).padStart(5, '0'),
          ])];
          for (const code of variants) {
            try {
              const fd = new FormData();
              fd.append('tracking-number', code);
              const res = await fetch(`${base}/parcel-info`, { method: 'POST', body: fd });
              if (!res.ok) continue;
              const json = await res.json();
              const parcel = json['PARCEL-INFO'] || json;
              const infos = parcel['INFOS'] || parcel;
              const phone = digits(infos['PHONE'] || infos['RECIPIENT-PHONE'] || infos['RECEIVER-PHONE']);
              if (!phone) continue;
              codePhone.set(code.toUpperCase(), phone);
              const order = byPhone.get(phone);
              if (order) found.push({ code, order });
            } catch {}
          }
        }));
        setOzonRestore({ running: true, message: `Analyse ${Math.min(start + CONC - 1, MAX)}/${MAX} — ${found.length} colis retrouvé(s)` });
      }

      // Sécurités : jamais un code « MIMA » ; seulement si le code diffère ; un code
      // déjà porté par une AUTRE commande n'est pas réattribué (pas de doublon) ; et
      // une commande ne peut recevoir qu'un seul code.
      const takenBy = new Map();
      for (const o of orders || []) if (o.trackingNumber) takenBy.set(o.trackingNumber.toUpperCase(), o.id);

      // Codes PROUVÉS faux : le colis existe chez Ozon mais au nom d'un AUTRE
      // téléphone. Ces commandes ne doivent plus bloquer la réattribution du code
      // à son vrai propriétaire, et leur propre code doit être corrigé.
      const wrongHolders = new Set();
      for (const o of orders || []) {
        if (isProtected(o) || !o.trackingNumber) continue;
        const ozPhone = codePhone.get(o.trackingNumber.toUpperCase());
        if (!ozPhone) continue;
        if (ozPhone !== digits(o.recipient?.phone)) wrongHolders.add(o.id);
      }

      const seenOrders = new Set();
      const toFix = [];
      let skipped = 0;
      for (const { code, order } of found) {
        if (isProtected(order) || order.trackingNumber === code) continue;
        const owner = takenBy.get(code.toUpperCase());
        // Un détenteur dont le code est prouvé faux n'est pas un vrai conflit.
        if ((owner && owner !== order.id && !wrongHolders.has(owner)) || seenOrders.has(order.id)) { skipped++; continue; }
        seenOrders.add(order.id);
        toFix.push({ code, order });
      }
      // Commandes au code prouvé faux et pour lesquelles Ozon n'a AUCUN colis :
      // on retire le code erroné (l'app réaffiche l'identifiant d'origine) plutôt
      // que de laisser un code qui appartient à un autre client.
      let cleared = 0;
      for (const o of orders || []) {
        if (!wrongHolders.has(o.id) || seenOrders.has(o.id)) continue;
        seenOrders.add(o.id);
        toFix.push({ code: null, order: o });
        cleared++;
      }
      const notes = [];
      if (ambiguous) notes.push(`${ambiguous} commande(s) ignorée(s) (même téléphone)`);
      if (skipped) notes.push(`${skipped} conflit(s) ignoré(s)`);
      if (cleared) notes.push(`${cleared} code(s) erroné(s) retiré(s)`);
      const suffix = notes.length ? ` — ${notes.join(', ')}` : '';
      if (!toFix.length) {
        setOzonRestore({ running: false, message: `Terminé : ${found.length} colis vérifié(s), aucun code à corriger${suffix}.` });
        return;
      }
      const B = 20;
      let failed = 0;
      const okIds = new Set();
      for (let i = 0; i < toFix.length; i += B) {
        await Promise.all(toFix.slice(i, i + B).map(({ code, order }) =>
          supabase.from('orders').update({ tracking_number: code, ozone_tracking: code, date_updated: stampNow() }).eq('id', order.id)
            .then(({ error }) => { if (error) failed++; else okIds.add(order.id); })
            .catch(() => { failed++; })
        ));
      }
      // On n'applique en local QUE les écritures réellement réussies.
      const map = new Map(toFix.filter(({ order }) => okIds.has(order.id)).map(({ code, order }) => [order.id, code]));
      // Le livreur mémorisé appartenait à l'ancien code : on le supprime pour
      // qu'il soit re-récupéré depuis la fenêtre « Livraison ».
      for (const id of map.keys()) { try { localStorage.removeItem(`ozone_dp_${id}`); } catch {} }
      // On aligne AUSSI la date locale sur celle écrite en base : sinon la copie
      // locale reste « plus ancienne » et une re-synchronisation peut réécrire
      // l'ancien code par-dessus la correction (effet « ça ne se sauvegarde pas »).
      const stamped = stampNow();
      setOrders(prev => prev.map(o => map.has(o.id)
        ? { ...o, trackingNumber: map.get(o.id), ozoneTracking: map.get(o.id), dateUpdated: stamped }
        : o));
      setOzonRestore({
        running: false,
        message: `✅ ${map.size} code(s) restauré(s)${failed ? ` — ⚠️ ${failed} échec(s)` : ''}${suffix}.`,
      });
    } catch (e) {
      setOzonRestore({ running: false, message: 'Erreur : ' + (e?.message || 'échec') });
    }
  }

  /* ── Correction des codes de suivi EN DOUBLE ──
     Pour chaque code partagé par plusieurs commandes : on demande à Ozon à qui
     appartient réellement ce code (téléphone du destinataire). Cette commande le
     GARDE ; les autres reçoivent un nouveau numéro libre. Si Ozon ne connaît pas
     le code, la commande la plus ANCIENNE le garde. Les codes « MIMA » sont exclus. */
  const [dupFix, setDupFix] = useState({ running: false, message: '' });
  const [queueMsg, setQueueMsg] = useState('');
  const [diag, setDiag] = useState({ running: false, lines: [] });

  /* Diagnostic LECTURE SEULE : que contient la base pour les codes en double ? */
  async function runDupDiagnostic() {
    setDiag({ running: true, lines: [] });
    try {
      let all = [];
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase.from('orders')
          .select('id, tracking_number, ozone_tracking, date_updated, status, recipient, is_deleted')
          .order('id', { ascending: true }).range(from, from + PAGE - 1);
        if (error) { setDiag({ running: false, lines: ['Erreur : ' + error.message] }); return; }
        const b = data || [];
        all = all.concat(b);
        if (b.length < PAGE) break;
      }
      const active = all.filter(r => !r.is_deleted);
      const m = new Map();
      for (const r of active) {
        const c = (r.tracking_number || '').trim();
        if (!c) continue;
        if (!m.has(c)) m.set(c, []);
        m.get(c).push(r);
      }
      const dups = [...m.entries()].filter(([, l]) => l.length > 1);

      /* Où en est la série VICT ? (question la plus fréquente) */
      const victNum = (v) => { const x = /^VICT(\d+)$/i.exec(String(v || '').trim()); return x ? parseInt(x[1], 10) : 0; };
      const nums = new Set();
      for (const r of active) {
        for (const n of [victNum(r.id), victNum(r.tracking_number)]) if (n) nums.add(n);
      }
      const sorted = [...nums].sort((a, b) => a - b);
      const normal = sorted.filter(n => n < 1000);
      const aberrants = sorted.filter(n => n >= 1000);
      const maxNormal = normal.length ? normal[normal.length - 1] : 0;
      const libres = [];
      for (let n = 1; n <= maxNormal && libres.length < 10; n++) if (!nums.has(n)) libres.push('VICT' + String(n).padStart(4, '0'));
      const fmt = (n) => 'VICT' + String(n).padStart(4, '0');

      const lines = [
        `Lignes en base : ${all.length} (actives ${active.length})`,
        '',
        '── SÉRIE VICT ──',
        `Dernier numéro de la série : ${maxNormal ? fmt(maxNormal) : '—'}`,
        `Prochain numéro attribué   : ${fmt(maxNormal + 1)}`,
        `Numéros VICT utilisés      : ${nums.size}`,
        aberrants.length
          ? `Numéros aberrants (>= 1000) : ${aberrants.length} — ${aberrants.slice(0, 8).map(fmt).join(', ')}${aberrants.length > 8 ? '…' : ''}`
          : 'Numéros aberrants (>= 1000) : aucun',
        libres.length ? `Trous dans la série : ${libres.join(', ')}${libres.length === 10 ? '…' : ''}` : 'Trous dans la série : aucun',
        '',
        `Codes en double EN BASE : ${dups.length}`,
        '',
      ];
      for (const [code, list] of dups.slice(0, 3)) {
        lines.push(`── ${code} ──`);
        for (const r of list) {
          lines.push(`  id=${r.id} | ${r.recipient?.name || '?'} | maj=${r.date_updated || '?'} | ozon=${r.ozone_tracking || '-'} | ${r.status}`);
        }
        lines.push('');
      }
      if (!dups.length) lines.push('🎉 Aucun doublon en base : l’alerte affichée vient de données locales périmées (rechargez).');
      setDiag({ running: false, lines });
    } catch (e) {
      setDiag({ running: false, lines: ['Erreur : ' + (e?.message || 'échec')] });
    }
  }

  async function fixDuplicateCodes() {
    const cfg = { customerId: auzone.customerId, apiKey: auzone.apiKey };
    const digits = (s) => String(s || '').replace(/\D/g, '').replace(/^212/, '0');
    const isProtected = (o) => /mima/i.test(`${o.trackingNumber || ''} ${o.ozoneTracking || ''} ${o.id || ''}`);
    const victNum = (s) => { const m = /^VICT(\d+)$/i.exec(s || ''); return m ? parseInt(m[1], 10) : 0; };
    const ts = (s) => {
      const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
      return m ? new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime() : 0;
    };

    // On travaille sur les données FRAÎCHES de la base (pas sur l'état local, qui
    // peut être périmé ou différent d'un appareil à l'autre).
    setDupFix({ running: true, message: 'Lecture des commandes depuis la base…' });
    let dbOrders = [];
    try {
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase.from('orders')
          .select('id, tracking_number, ozone_tracking, recipient, date_added, status')
          .or('is_deleted.is.null,is_deleted.eq.false')
          .order('id', { ascending: true }).range(from, from + PAGE - 1);
        if (error) { setDupFix({ running: false, message: 'Lecture impossible : ' + error.message }); return; }
        const batch = data || [];
        dbOrders = dbOrders.concat(batch);
        if (batch.length < PAGE) break;
      }
    } catch (e) {
      setDupFix({ running: false, message: 'Lecture impossible : ' + (e?.message || 'échec') }); return;
    }
    const rows = dbOrders.map(r => ({
      id: r.id, trackingNumber: r.tracking_number, ozoneTracking: r.ozone_tracking,
      recipient: r.recipient || {}, dateAdded: r.date_added, status: r.status,
    }));

    // Groupes de commandes partageant le même code (ids DISTINCTS uniquement).
    // Le code d'une commande peut être porté par son `tracking_number` OU par son
    // identifiant (les anciennes commandes s'appellent VICT0002). Les deux doivent
    // entrer dans le même groupe, sinon le doublon passe inaperçu.
    const groups = new Map();
    for (const o of rows) {
      const codes = new Set();
      const tn = (o.trackingNumber || '').trim();
      if (tn) codes.add(tn.toUpperCase());
      if (victNum(o.id)) codes.add(String(o.id).trim().toUpperCase());
      if (!codes.size || isProtected(o)) continue;
      for (const code of codes) {
        if (!groups.has(code)) groups.set(code, new Map());
        groups.get(code).set(o.id, o);
      }
    }
    for (const [code, m] of groups) groups.set(code, [...m.values()]);
    const dupes = [...groups.entries()].filter(([, list]) => list.length > 1);
    if (!dupes.length) { setDupFix({ running: false, message: 'Aucun doublon à corriger.' }); return; }

    setDupFix({ running: true, message: `Analyse de ${dupes.length} code(s) en double…` });

    // Numéros déjà utilisés (tous codes confondus) pour n'en réattribuer aucun.
    const used = new Set();
    for (const o of rows) {
      for (const n of [victNum(o.id), victNum(o.trackingNumber)]) if (n) used.add(n);
    }
    // On attribue le PLUS PETIT numéro libre (on comble les trous de la série)
    // au lieu de repartir du plus grand : sinon d'anciens numéros erronés très
    // élevés (VICT14xx) feraient bondir la numérotation.
    let next = 0;
    const nextFreeCode = () => { do { next += 1; } while (used.has(next)); used.add(next); return 'VICT' + String(next).padStart(4, '0'); };

    const base = cfg.customerId && cfg.apiKey
      ? `https://api.ozonexpress.ma/customers/${cfg.customerId}/${cfg.apiKey}` : null;

    const updates = []; // { id, code }
    let byOzon = 0;
    try {
      for (const [code, list] of dupes) {
        // Qui possède vraiment ce code d'après Ozon ?
        let ownerId = null;
        if (base) {
          try {
            const fd = new FormData();
            fd.append('tracking-number', code);
            const res = await fetch(`${base}/parcel-info`, { method: 'POST', body: fd });
            if (res.ok) {
              const json = await res.json();
              const parcel = json['PARCEL-INFO'] || json;
              const infos = parcel['INFOS'] || parcel;
              const phone = digits(infos['PHONE'] || infos['RECIPIENT-PHONE'] || infos['RECEIVER-PHONE']);
              if (phone) {
                const match = list.find(o => digits(o.recipient?.phone) === phone);
                if (match) { ownerId = match.id; byOzon++; }
              }
            }
          } catch {}
        }
        // Sinon : la commande dont l'IDENTIFIANT est ce code en est la
        // propriétaire naturelle ; à défaut, la plus ancienne le garde.
        if (!ownerId) {
          const byId = list.find(o => String(o.id).trim().toUpperCase() === code.toUpperCase());
          ownerId = byId ? byId.id : [...list].sort((a, b) => ts(a.dateAdded) - ts(b.dateAdded))[0].id;
        }
        for (const o of list) {
          if (o.id === ownerId) continue;
          // Le perdant ne doit pas garder ce code, ni comme suivi ni comme
          // référence Ozon (ce colis appartient à quelqu'un d'autre).
          const dropOzon = String(o.ozoneTracking || '').trim().toUpperCase() === code.toUpperCase();
          updates.push({ id: o.id, code: nextFreeCode(), dropOzon });
        }
        setDupFix({ running: true, message: `Analyse… ${updates.length} commande(s) à renuméroter` });
      }

      // Ramener aussi les numéros ABERRANTS (>= 1000, issus de l'ancien incident)
      // dans la série normale, en comblant les trous.
      const already = new Set(updates.map(u => u.id));
      const aberrant = rows
        .filter(o => !isProtected(o) && !already.has(o.id) && victNum(o.trackingNumber) >= 1000)
        .sort((a, b) => ts(a.dateAdded) - ts(b.dateAdded));
      for (const o of aberrant) updates.push({ id: o.id, code: nextFreeCode() });

      if (!updates.length) { setDupFix({ running: false, message: 'Aucun changement nécessaire.' }); return; }

      let failed = 0;
      let lastError = '';
      const okIds = new Map();
      const B = 20;
      for (let i = 0; i < updates.length; i += B) {
        await Promise.all(updates.slice(i, i + B).map(({ id, code, dropOzon }) =>
          supabase.from('orders')
            .update({ tracking_number: code, date_updated: stampNow(), ...(dropOzon ? { ozone_tracking: null } : {}) })
            .eq('id', id)
            .then(({ error }) => { if (error) { failed++; lastError = error.message; } else okIds.set(id, code); })
            .catch((e) => { failed++; lastError = e?.message || 'réseau'; })
        ));
      }

      // VÉRIFICATION : on relit depuis Supabase pour confirmer que la valeur a bien
      // été enregistrée (une écriture « acceptée » mais non persistée expliquerait
      // que les doublons réapparaissent après un rechargement).
      setDupFix({ running: true, message: 'Vérification en base…' });
      const ids = [...okIds.keys()];
      const persisted = new Map();
      for (let i = 0; i < ids.length; i += 100) {
        const { data } = await supabase.from('orders').select('id, tracking_number').in('id', ids.slice(i, i + 100));
        for (const row of (data || [])) persisted.set(row.id, row.tracking_number);
      }
      const notPersisted = ids.filter(id => persisted.get(id) !== okIds.get(id));

      // On n'applique en local QUE ce qui est réellement en base.
      const applied = new Map([...okIds].filter(([id, code]) => persisted.get(id) === code));
      const dropped = new Set(updates.filter(u => u.dropOzon).map(u => u.id));
      // Le livreur mémorisé appartenait à l'ancien code : on l'oublie.
      for (const id of applied.keys()) { try { localStorage.removeItem(`ozone_dp_${id}`); } catch {} }
      const stamped = stampNow();
      setOrders(prev => prev.map(o => applied.has(o.id)
        ? { ...o, trackingNumber: applied.get(o.id), dateUpdated: stamped, ...(dropped.has(o.id) ? { ozoneTracking: null } : {}) }
        : o));

      // La file de synchronisation peut contenir d'anciens instantanés qui
      // réécriraient les codes qu'on vient de corriger : on la vide.
      try { const { clearSyncQueue } = await import('../lib/offlineStore'); await clearSyncQueue(); } catch {}

      // CONTRÔLE FINAL : on recompte les doublons directement en base. S'il en
      // reste, c'est qu'un autre appareil (onglet resté ouvert avec une ancienne
      // version) réécrit les anciennes valeurs — on le dit clairement.
      setDupFix({ running: true, message: 'Contrôle final…' });
      let after = [];
      try {
        const PAGE = 1000;
        let all = [];
        for (let from = 0; ; from += PAGE) {
          const { data } = await supabase.from('orders').select('id, tracking_number')
            .or('is_deleted.is.null,is_deleted.eq.false')
            .order('id', { ascending: true }).range(from, from + PAGE - 1);
          const batch = data || [];
          all = all.concat(batch);
          if (batch.length < PAGE) break;
        }
        const m = new Map();
        for (const r of all) {
          const c = (r.tracking_number || '').trim();
          if (!c) continue;
          if (!m.has(c)) m.set(c, new Set());
          m.get(c).add(r.id);
        }
        after = [...m.entries()].filter(([, s]) => s.size > 1);
      } catch {}

      const parts = [`✅ ${applied.size} commande(s) corrigée(s) et vérifiée(s) en base`];
      if (byOzon) parts.push(`${byOzon} propriétaire(s) confirmé(s) par Ozon`);
      if (failed) parts.push(`⚠️ ${failed} refus d'écriture${lastError ? ` (${lastError})` : ''}`);
      if (notPersisted.length) parts.push(`⛔ ${notPersisted.length} non enregistré(s) — droits d'écriture ?`);
      parts.push(after.length
        ? `⛔ il reste ${after.length} doublon(s) EN BASE — fermez l'application sur les autres appareils puis relancez`
        : '🎉 plus aucun doublon en base — rechargement…');
      setDupFix({ running: false, message: parts.join(' — ') });
      // Succès : on recharge pour repartir des données de la base (l'affichage
      // conservait sinon l'ancienne liste locale et semblait « inchangé »).
      if (!after.length) setTimeout(() => window.location.reload(), 2500);
    } catch (e) {
      setDupFix({ running: false, message: 'Erreur : ' + (e?.message || 'échec') });
    }
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

          {/* Récupération des VRAIS codes de suivi depuis Ozon (action manuelle) */}
          <div className="border-t border-gray-100 pt-3 mt-1 space-y-2">
            <p className="text-xs font-semibold text-gray-700">Restaurer les codes de suivi depuis Ozon</p>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Interroge Ozon pour retrouver le code VICT réellement enregistré pour chaque colis
              (recherche par numéro de téléphone) et le remet dans l'application. Aucun code n'est
              effacé : seules les commandes dont le code diffère sont corrigées.
              <strong className="text-gray-700"> Les codes contenant « MIMA » ne sont jamais modifiés.</strong>
            </p>
            <div className="flex items-center gap-2">
              <button onClick={restoreOzonCodes} disabled={ozonRestore.running || !auzone.customerId || !auzone.apiKey}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-40 transition">
                {ozonRestore.running ? 'Recherche…' : 'Restaurer les codes'}
              </button>
              {ozonRestore.message && <span className="text-xs text-gray-600">{ozonRestore.message}</span>}
            </div>
          </div>

          {/* Correction des codes en double */}
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <p className="text-xs font-semibold text-gray-700">Corriger les codes de suivi en double</p>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Quand un même code est porté par plusieurs commandes, Ozon indique à qui il
              appartient réellement : cette commande garde le code, les autres reçoivent un
              nouveau numéro libre (jamais un numéro déjà utilisé).
              <strong className="text-gray-700"> Les codes « MIMA » sont exclus.</strong>
            </p>
            <div className="flex items-center gap-2">
              <button onClick={fixDuplicateCodes} disabled={dupFix.running}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-40 transition">
                {dupFix.running ? 'Correction…' : 'Corriger les doublons'}
              </button>
              {dupFix.message && <span className="text-xs text-gray-600">{dupFix.message}</span>}
            </div>
          </div>

          {/* File d'attente hors-ligne : des instantanés périmés peuvent réécrire
              d'anciennes valeurs (codes de suivi qui « reviennent »). */}
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <p className="text-xs font-semibold text-gray-700">Vider la file d'attente de synchronisation</p>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              À utiliser si des modifications reviennent à leur ancienne valeur après un
              rechargement : d'anciennes copies en attente sont alors réécrites en base.
            </p>
            <div className="flex items-center gap-2">
              <button onClick={async () => {
                try {
                  const { clearSyncQueue } = await import('../lib/offlineStore');
                  await clearSyncQueue();
                  setQueueMsg('✅ File d\'attente vidée.');
                } catch (e) { setQueueMsg('Erreur : ' + (e?.message || 'échec')); }
              }}
                className="px-4 py-2 rounded-lg bg-gray-800 text-white text-xs font-medium hover:bg-gray-900 transition">
                Vider la file
              </button>
              {queueMsg && <span className="text-xs text-gray-600">{queueMsg}</span>}
            </div>
          </div>

          {/* Diagnostic : montre ce que contient RÉELLEMENT la base pour un doublon */}
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <p className="text-xs font-semibold text-gray-700">Diagnostic des doublons</p>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Lit la base et affiche, pour le premier code en double, les commandes
              concernées avec leur date de mise à jour. Aucune écriture.
            </p>
            <div className="flex items-center gap-2">
              <button onClick={runDupDiagnostic} disabled={diag.running}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-40 transition">
                {diag.running ? 'Lecture…' : 'Diagnostic'}
              </button>
            </div>
            {diag.lines.length > 0 && (
              <pre className="text-[10px] bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                {diag.lines.join('\n')}
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
