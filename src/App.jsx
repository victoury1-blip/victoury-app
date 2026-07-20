import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import LoginPage from './components/LoginPage';
import ScrollToTop from './components/ScrollToTop';
import OfflineBanner from './components/OfflineBanner';
import PWAUpdateBanner from './components/PWAUpdateBanner';

const Dashboard = React.lazy(() => import('./components/Dashboard'));
const OrdersPage = React.lazy(() => import('./components/OrdersPage'));
const SettingsPage = React.lazy(() => import('./components/SettingsPage'));
const EtatsPage = React.lazy(() => import('./components/EtatsPage'));
const LivraisonPage = React.lazy(() => import('./components/LivraisonPage'));
const ListeColisPage = React.lazy(() => import('./components/ListeColisPage'));
const GoogleSheetsPage = React.lazy(() => import('./components/GoogleSheetsPage'));
const StockPage = React.lazy(() => import('./components/StockPage'));
const ChicAffiliatePage = React.lazy(() => import('./components/ChicAffiliatePage'));
const FacturesPage = React.lazy(() => import('./components/FacturesPage'));
const ProfitPage = React.lazy(() => import('./components/ProfitPage'));
const RamassagePage = React.lazy(() => import('./components/RamassagePage'));
const AnalyticsPage = React.lazy(() => import('./components/AnalyticsPage'));
const RetourPage = React.lazy(() => import('./components/RetourPage'));
const ModeratorsPage = React.lazy(() => import('./components/ModeratorsPage'));
import { supabase } from './lib/supabase';
const _offlineStore = () => import('./lib/offlineStore');
const saveOrdersOffline = async (...a) => (await _offlineStore()).saveOrdersOffline(...a);
const loadOrdersOffline = async (...a) => (await _offlineStore()).loadOrdersOffline(...a);
const queueSync = async (...a) => (await _offlineStore()).queueSync(...a);
const getPendingSync = async (...a) => (await _offlineStore()).getPendingSync(...a);
const deleteSyncItem = async (...a) => (await _offlineStore()).deleteSyncItem(...a);
const deleteOrderOffline = async (...a) => (await _offlineStore()).deleteOrderOffline(...a);
import { cloudGet, cloudSet } from './lib/cloudSettings';
import { getChicConfig, fetchChicRecentOrders, computeChicStatusUpdates } from './lib/chicAffiliate';
import { logAlert } from './lib/errorLog';
import useAutoSync from './hooks/useAutoSync';
import useNotifications from './hooks/useNotifications';
import useOrderNotifications from './hooks/useOrderNotifications';
import ErrorBoundary from './components/ErrorBoundary';
import IOSInstallPrompt from './components/IOSInstallPrompt';
import { PermissionsProvider, usePermissions } from './lib/permissions';
import { ToastProvider } from './components/Toast';

const TAB_FROM_PARAM = {
  'a-confirmer': 'a_confirmer',
  'en-suivi':    'en_suivi',
  'reporter':    'reporter',
  'confirme':    'confirme',
};

function OrdersRoute({ orders, setOrdersWithSync, isLoading, onDeleteOrder, currentUser }) {
  const { tab } = useParams();
  const activeTab = TAB_FROM_PARAM[tab] || 'a_confirmer';
  const navigate = useNavigate();
  return (
    <OrdersPage
      activeTab={activeTab}
      setActiveTab={(t) => navigate(`/commandes/${t.replace(/_/g, '-')}`)}
      externalOrders={orders}
      setExternalOrders={setOrdersWithSync}
      isLoading={isLoading}
      onDeleteOrder={onDeleteOrder}
      currentUser={currentUser}
    />
  );
}

function PermGate({ perm, children }) {
  const { hasPermission } = usePermissions();
  if (!hasPermission(perm)) return <div className="flex items-center justify-center h-full text-gray-400"><p>Accès non autorisé</p></div>;
  return children;
}

function UnderConstruction() {
  return (
    <div className="flex items-center justify-center h-full text-gray-400 text-lg">
      <div className="text-center">
        <div className="text-5xl mb-4">🚧</div>
        <p>Cette page est en cours de développement</p>
      </div>
    </div>
  );
}

function mapRow(o) {
  return {
    id: o.id,
    recipient: o.recipient,
    product: o.product,
    products: o.products || null,
    price: o.price,
    status: o.status,
    note: o.note,
    dateAdded: o.date_added,
    dateUpdated: o.date_updated,
    validated: o.validated,
    echange: o.echange || false,
    reportDate: o.report_date || null,
    noteLivraison: o.note_livraison || '',
    trackingNumber: o.tracking_number || null,
    ozoneTracking: o.ozone_tracking || null,
    ozoneLastStatus: o.ozone_last_status || null,
    manuallyModified: o.manually_modified || false,
    recu: o.recu || false,
  };
}

export default function App() {
  const [session, setSession] = useState(undefined);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWooFetching, setIsWooFetching] = useState(false);
  const [wooError, setWooError] = useState(null);
  const [dbError, setDbError] = useState(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const modifiedIdsRef = useRef(new Set());
  const deletedIdsRef = useRef(new Set());
  const initialLoadDoneRef = useRef(false);
  const wooConfigRef = useRef(null);
  const notifConfigRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const ordersRef = useRef(orders);
  ordersRef.current = orders;
  const navigate = useNavigate();
  const location = useLocation();

  useAutoSync(session);
  const { notifyNewOrder } = useOrderNotifications();

  const [notifPerm, setNotifPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'denied');

  // Android Chrome ignore Notification.requestPermission() appelé au chargement :
  // il exige un geste utilisateur. On demande donc l'autorisation au premier
  // tap sur l'écran. Sans autorisation « granted », setAppBadge() échoue en
  // silence et le « 1 » n'apparaît jamais sur l'icône de l'app.
  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'default') { setNotifPerm(Notification.permission); return; }
    const ask = () => {
      try {
        Notification.requestPermission().then(p => setNotifPerm(p)).catch(() => {});
      } catch {}
      window.removeEventListener('pointerdown', ask);
      window.removeEventListener('keydown', ask);
    };
    window.addEventListener('pointerdown', ask, { once: true });
    window.addEventListener('keydown', ask, { once: true });
    return () => {
      window.removeEventListener('pointerdown', ask);
      window.removeEventListener('keydown', ask);
    };
  }, []);

  // Le compteur sur l'icône (Badging API + notification silencieuse de secours
  // pour Android/Samsung) est géré par useNotifications, qui se ré-applique dès
  // que l'autorisation passe à « granted ».
  useNotifications(orders, notifPerm);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  /* ── Process sync queue when back online ── */
  useEffect(() => {
    async function processSyncQueue() {
      try {
        const pending = await getPendingSync();
        if (!pending.length) return;
        for (const item of pending) {
          try {
            let error = null;
            if (item.action === 'update') {
              const o = item.data;
              const r = await supabase.from('orders').upsert({
                id: o.id, status: o.status, note: o.note, validated: o.validated,
                recipient: o.recipient, product: o.product, products: o.products || null,
                price: o.price, date_added: o.dateAdded,
                date_updated: new Date().toLocaleString('fr-MA'),
                echange: o.echange || false, report_date: o.reportDate || null,
                note_livraison: o.noteLivraison || '', tracking_number: o.trackingNumber || null,
                manually_modified: o.manuallyModified || false,
                ...(o.ozoneTracking ? { ozone_tracking: o.ozoneTracking } : {}),
                ...(o.ozoneLastStatus ? { ozone_last_status: o.ozoneLastStatus } : {}),
              }, { onConflict: 'id' });
              error = r.error;
            } else if (item.action === 'delete') {
              const r = await supabase.from('orders').update({ is_deleted: true }).eq('id', item.data.id);
              error = r.error;
            }
            // Ne supprimer de la file QUE les items réellement réappliqués : ceux qui
            // échouent (réseau, RLS…) sont conservés et rejoués au prochain passage.
            if (!error) await deleteSyncItem(item.id);
            else console.error('Sync queue item failed:', error);
          } catch (e) {
            console.error('Sync queue item failed:', e);
          }
        }
      } catch (e) {
        console.error('Failed to process sync queue:', e);
      }
    }
    const handler = () => processSyncQueue();
    window.addEventListener('online', handler);
    // rejouer aussi au démarrage si des mutations sont restées en attente d'une session précédente
    if (navigator.onLine) processSyncQueue();
    return () => window.removeEventListener('online', handler);
  }, []);

  /* ── Auth ── */
  useEffect(() => {
    const timeout = setTimeout(() => setSession(null), 2500);
    supabase.auth.getSession().then(({ data }) => { clearTimeout(timeout); setSession(data.session ?? null); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  /* ── Preload critical settings from Supabase (parallel) ── */
  useEffect(() => {
    if (!session) return;
    const PRELOAD_KEYS = [
      'victoury_app_config', 'victoury_shop_config', 'victoury_profile',
      'auzone_config', 'woo_config', 'livreurs', 'victoury_statuses',
      'phone_colors', 'notification_sound', 'system_timezone',
      'victoury_sent_livreur', 'victoury_recu_ids', 'victoury_manual_facture',
    ];
    const userId = session?.user?.id;
    const promises = [];
    // Load user-scoped settings
    if (userId) {
      promises.push(
        supabase.from('settings').select('key, value').in('key', PRELOAD_KEYS).eq('user_id', userId)
      );
    }
    // Also load null-user settings as fallback
    promises.push(
      supabase.from('settings').select('key, value').in('key', PRELOAD_KEYS).is('user_id', null)
    );
    Promise.all(promises).then(results => {
      const found = new Set();
      for (const { data } of results) {
        if (!data) continue;
        for (const row of data) {
          if (row.value != null && !found.has(row.key)) {
            found.add(row.key);
            localStorage.setItem(row.key, JSON.stringify(row.value));
          }
        }
      }
    });
  }, [session]);

  /* ── Load orders from Supabase ── */
  useEffect(() => {
    if (!session) return;
    async function load(attempt = 0) {
      /* Load only non-deleted orders */
      let data, error;
      try {
        const res = await supabase
          .from('orders')
          .select('*')
          // `neq('is_deleted', true)` exclut les lignes où is_deleted IS NULL (NULL <> true = NULL) :
          // on inclut explicitement NULL et false pour ne pas masquer des commandes valides.
          .or('is_deleted.is.null,is_deleted.eq.false')
          .order('created_at', { ascending: false });
        data = res.data; error = res.error;
      } catch (e) {
        error = e;
      }
      if (error || !data) {
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
          return load(attempt + 1);
        }
        setDbError('⚠️ Erreur Supabase: ' + (error?.message || 'impossible de charger les commandes'));
        // Fallback to IndexedDB cached orders
        try {
          const cached = await loadOrdersOffline();
          if (cached.length) {
            setOrders(cached);
            setDbError(prev => prev + ' — données hors-ligne chargées');
          }
        } catch (offlineErr) {
          console.error('Failed to load offline orders:', offlineErr);
        }
        setIsLoading(false);
        return;
      }
      /* Build blacklist from soft-deleted rows — survives cache resets */
      const { data: delRows } = await supabase.from('orders').select('id').eq('is_deleted', true);
      const deletedIds = (delRows || []).map(r => r.id);
      deletedIdsRef.current = new Set(deletedIds);
      localStorage.setItem('deleted_order_ids', JSON.stringify(deletedIds));
      setOrders(data.map(mapRow));
      setIsLoading(false);
      initialLoadDoneRef.current = true;
      // Cache orders to IndexedDB for offline use
      saveOrdersOffline(data.map((o) => ({
        id: o.id, recipient: o.recipient, product: o.product, products: o.products || null,
        price: o.price, status: o.status, note: o.note, dateAdded: o.date_added,
        dateUpdated: o.date_updated, validated: o.validated, echange: o.echange || false,
        reportDate: o.report_date || null, noteLivraison: o.note_livraison || '',
        trackingNumber: o.tracking_number || null, ozoneTracking: o.ozone_tracking || null,
        ozoneLastStatus: o.ozone_last_status || null, manuallyModified: o.manually_modified || false,
      }))).catch(e => console.error('Failed to cache orders offline:', e));
    }
    load();
  }, [session]);

  /* ── Realtime: sync order changes from other devices ── */
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel('orders-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, ({ new: o }) => {
        if (o.is_deleted || deletedIdsRef.current.has(o.id)) return;
        setOrders(prev => {
          if (prev.some(x => x.id === o.id)) return prev;
          if (initialLoadDoneRef.current) notifyNewOrder(mapRow(o));
          return [mapRow(o), ...prev];
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, ({ new: o }) => {
        if (o.is_deleted) {
          deletedIdsRef.current.add(o.id);
          setOrders(prev => prev.filter(x => x.id !== o.id));
          return;
        }
        // réactivation : retirer de la liste noire et ajouter si absent
        deletedIdsRef.current.delete(o.id);
        setOrders(prev => prev.some(x => x.id === o.id)
          ? prev.map(x => x.id === o.id ? { ...x, ...mapRow(o) } : x)
          : [mapRow(o), ...prev]);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, ({ old }) => {
        setOrders(prev => prev.filter(x => x.id !== old.id));
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [session]);

  /* ── Reload settings from Supabase when app regains focus (cross-device sync) ── */
  useEffect(() => {
    if (!session) return;
    const SYNC_KEYS = [
      'livreurs', 'victoury_products', 'victoury_statuses',
      'auzone_config', 'woo_config', 'victoury_app_config', 'victoury_shop_config',
      'phone_colors', 'notification_sound',
    ];
    const userId = session?.user?.id;
    async function reloadSettings() {
      try {
        const promises = [];
        if (userId) promises.push(supabase.from('settings').select('key, value').in('key', SYNC_KEYS).eq('user_id', userId));
        promises.push(supabase.from('settings').select('key, value').in('key', SYNC_KEYS).is('user_id', null));
        const results = await Promise.all(promises);
        const seen = new Set();
        for (const { data } of results) {
          if (!data) continue;
          for (const row of data) {
            if (row.value != null && !seen.has(row.key)) {
              seen.add(row.key);
              localStorage.setItem(row.key, JSON.stringify(row.value));
            }
          }
        }
      } catch {}
    }
    const onVisibility = () => { if (document.visibilityState === 'visible') reloadSettings(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [session]);

  /* ── Error logger → Supabase error_logs table ── */
  function logError(source, message, details = {}) {
    // Centre d'alertes local (visible immédiatement)
    logAlert(source, message);
    supabase.from('error_logs').insert({ source, message, details }).then(({ error }) => {
      if (error) console.error('[logError] failed to write to error_logs:', error.message);
    });
  }

  /* ── WC sync logger ── */
  function logWcSync(entry) {
    const MAX = 100;
    cloudGet('wc_sync_logs').then(logs => {
      const prev = Array.isArray(logs) ? logs : [];
      const next = [{ ...entry, ts: new Date().toISOString() }, ...prev].slice(0, MAX);
      cloudSet('wc_sync_logs', next);
    });
  }

  /* ── WooCommerce polling ── */
  useEffect(() => {
    if (!session) return;
    async function fetchWooOrders() {
      try {
        if (!wooConfigRef.current) {
          const stored = localStorage.getItem('woo_config');
          wooConfigRef.current = stored ? JSON.parse(stored) : (await cloudGet('woo_config') || {});
        }
        const config = wooConfigRef.current;
        if (!config.consumerKey || !config.consumerSecret) {
          setWooError('⚙️ WooCommerce non configuré — ajoutez vos clés API dans Paramètres');
          return;
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        let res;
        try {
          res = await fetch(
            `/wc-api/wp-json/wc/v3/orders?status=processing,pending&per_page=50`,
            { signal: controller.signal, headers: { Authorization: 'Basic ' + btoa(`${config.consumerKey}:${config.consumerSecret}`) } }
          );
        } finally { clearTimeout(timeout); }
        if (!res.ok) { setWooError('⚠️ WooCommerce: erreur ' + res.status + ' — vérifiez vos clés API dans Paramètres'); return; }
        setWooError(null);
        const data = await res.json();
        const getMeta = (meta, ...keys) => {
          if (!meta) return '';
          /* Exact & attribute_ prefix match */
          for (const k of keys) {
            const m = meta.find(x => x.key === k || x.key === `attribute_${k}`);
            if (m?.value) return String(m.value);
          }
          /* Fallback: search any key containing the word (case-insensitive) */
          for (const k of keys) {
            const m = meta.find(x => x.key?.toLowerCase().includes(k.replace('pa_', '')));
            if (m?.display_value || m?.value) return String(m.display_value || m.value);
          }
          return '';
        };
        /* Produits importés de Chic Affiliate : leurs commandes site ne passent pas
           par « À Confirmer » mais par l'onglet Commandes Site de la page Chic. */
        let chicNames = new Set();
        try {
          const prods = JSON.parse(localStorage.getItem('victoury_products') || '[]');
          const normName = s => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
          chicNames = new Set(prods.filter(p => p.source === 'chic-affiliate').map(p => normName(p.name)).filter(Boolean));
        } catch {}
        const isChicProduct = (name) => {
          const n = (name || '').toLowerCase().replace(/\s+/g, ' ').trim();
          if (!n) return false;
          if (chicNames.has(n)) return true;
          for (const c of chicNames) { if (c && (n.includes(c) || c.includes(n))) return true; }
          return false;
        };
        /* Map each WC order individually — bad order is skipped, not crashes the whole poll */
        const mapped = [];
        for (const o of data) {
          try {
            const products = (o.line_items || []).map(item => ({
              name: item.name || 'Produit',
              size: getMeta(item.meta_data, 'pa_taille', 'taille', 'size'),
              color: getMeta(item.meta_data, 'pa_couleur', 'couleur', 'color'),
              qty: item.quantity || 1,
            }));
            const firstItem = o.line_items?.[0] || {};
            mapped.push({
              id: `WC-${o.id}`,
              recipient: {
                name: `${o.billing.first_name} ${o.billing.last_name}`.trim(),
                address: o.billing.address_1 || '',
                city: o.billing.city || '',
                phone: o.billing.phone || '',
                delivery: null,
              },
              product: {
                name: firstItem.name || 'Produit WC',
                size: getMeta(firstItem.meta_data, 'pa_taille', 'taille', 'size'),
                color: getMeta(firstItem.meta_data, 'pa_couleur', 'couleur', 'color'),
                qty: (o.line_items || []).reduce((s, i) => s + (i.quantity || 1), 0),
                stock: 0,
              },
              products: products.length > 0 ? products : null,
              price: parseFloat(o.total) || 0,
              status: products.some(p => isChicProduct(p.name)) || isChicProduct(firstItem.name) ? 'chic_nouveau' : 'nouveau',
              note: o.customer_note || '',
              dateAdded: new Date(o.date_created).toLocaleString('fr-MA'),
              dateUpdated: new Date(o.date_modified).toLocaleString('fr-MA'),
              validated: false,
            });
          } catch (orderErr) {
            logError('wc_order_mapping', `Failed to map WC order #${o.id}: ${orderErr.message}`, { wc_id: o.id, error: orderErr.message });
          }
        }
        /* Use localStorage which is already synced with Supabase on startup */
        setOrders((prev) => {
          const existingIds = new Set(prev.map((o) => o.id));
          const fresh = mapped.filter((o) => !existingIds.has(o.id) && !deletedIdsRef.current.has(o.id));
          if (fresh.length) {
            /* Browser push notification for first new order */
            if (initialLoadDoneRef.current) fresh.slice(0, 1).forEach(notifyNewOrder);
            /* Play notification sound — only after initial DB load */
            if (initialLoadDoneRef.current) try {
              notifConfigRef.current = JSON.parse(localStorage.getItem('notification_sound') || '{}');
              const nc = notifConfigRef.current;
              if (nc.enabled !== false) {
                const vol = (nc.volume ?? 80) / 100;
                if (nc.customSound) {
                  const a = new Audio(nc.customSound); a.volume = vol; a.play().catch(() => {});
                } else {
                  const ctx = new (window.AudioContext || window.webkitAudioContext)();
                  const osc = ctx.createOscillator(); const gain = ctx.createGain();
                  osc.connect(gain); gain.connect(ctx.destination);
                  osc.frequency.setValueAtTime(880, ctx.currentTime);
                  osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
                  gain.gain.setValueAtTime(vol, ctx.currentTime);
                  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
                  osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5);
                }
              }
            } catch {}
            saveOrdersToSupabase(fresh).catch(err =>
              logError('supabase_save', `Failed to save ${fresh.length} orders: ${err.message}`, { count: fresh.length, error: err.message })
            );
          }
          /* Update price + products of existing WC orders (skip manually modified orders) */
          const priceMap = new Map(mapped.map(m => [m.id, { price: m.price, product: m.product, products: m.products }]));
          const changedWC = [];
          const updated = prev.map(o => {
            if (!o.id.startsWith('WC-')) return o;
            if (modifiedIdsRef.current.has(o.id) || o.manuallyModified) return o;
            const wc = priceMap.get(o.id);
            if (!wc || Math.abs((wc.price || 0) - (o.price || 0)) < 0.01) return o;
            const next = { ...o, price: wc.price, product: wc.product, products: wc.products };
            changedWC.push(next);
            return next;
          });
          /* Persist price changes to Supabase */
          changedWC.forEach(o =>
            supabase.from('orders').upsert({ id: o.id, price: o.price, product: o.product, products: o.products }, { onConflict: 'id' })
              .then(({ error }) => { if (error) logError('supabase_price_update', `Failed to update price for ${o.id}: ${error.message}`, { order_id: o.id, error: error.message }); })
          );
          /* Log success */
          if (fresh.length || changedWC.length) logWcSync({ status: 'success', newOrders: fresh.length, updatedOrders: changedWC.length });
          return fresh.length ? [...fresh, ...updated] : updated;
        });
      } catch (e) {
        const isTimeout = e?.name === 'AbortError';
        const msg = isTimeout ? 'délai dépassé (8s) — serveur WooCommerce lent' : (e?.message || 'erreur réseau');
        setWooError('⚠️ WooCommerce: ' + msg);
        logWcSync({ status: 'error', error: msg });
        logError('wc_poll', msg, { timeout: isTimeout });
      } finally {
        setIsWooFetching(false);
      }
    }
    fetchWooOrders();
    const interval = setInterval(fetchWooOrders, 30000);
    return () => clearInterval(interval);
  }, [session]);

  /* ── Ozone background sync (every 5 min) ── */
  useEffect(() => {
    if (!session) return;
    async function syncOzoneStatuses() {
      try {
        let cfg = JSON.parse(localStorage.getItem('auzone_config') || '{}');
        if (!cfg.customerId || !cfg.apiKey) {
          try { const r = await cloudGet('auzone_config'); if (r?.customerId) cfg = r; } catch {}
        }
        if (!cfg.customerId || !cfg.apiKey) return;
        const base = `https://api.ozonexpress.ma/customers/${cfg.customerId}/${cfg.apiKey}`;
        // Recherche le statut Ozon d'un numéro de suivi (null si introuvable / erreur).
        async function trackByNumber(tn) {
          const body = new FormData();
          body.append('tracking-number', tn);
          const ac = new AbortController();
          const t = setTimeout(() => ac.abort(), 10000);
          try {
            const res = await fetch(`${base}/tracking`, { method: 'POST', body, signal: ac.signal });
            clearTimeout(t);
            if (!res.ok) return null;
            const json = await res.json();
            const track = json?.['TRACKING'] || json || {};
            if ((track['RESULT'] || '').toUpperCase() === 'ERROR') return null;
            const last = track['LAST_TRACKING'] || track['LAST-TRACKING'] || {};
            return last['STATUT'] || last['STATUS'] || '';
          } catch { clearTimeout(t); return null; }
        }
        const isFinal = (s) => /livr|retour|refus/i.test(s || '');
        const toSync = ordersRef.current.filter(o => o.validated && (o.ozoneTracking || o.trackingNumber));
        // Phase 1 — API officielle de suivi (par numéro, avec variantes du 0).
        const stillPending = [];
        for (const o of toSync) {
          const tn = o.ozoneTracking || o.trackingNumber || o.id;
          try {
            let status = await trackByNumber(tn);
            if (!status) {
              const variants = [];
              const m = tn.match(/^([A-Za-z]+)(\d+)$/);
              if (m) variants.push(`${m[1]}0${m[2]}`);          // MIMA3251 → MIMA03251
              if (/^\d+$/.test(tn) && !tn.startsWith('0')) variants.push('0' + tn);
              for (const v of variants) { status = await trackByNumber(v); if (status) break; }
            }
            if (status && status !== o.ozoneLastStatus) {
              setOrders(prev => prev.map(x => x.id === o.id ? { ...x, ozoneLastStatus: status } : x));
              supabase.from('orders').update({ ozone_last_status: status }).eq('id', o.id).then(() => {});
            }
            if (!isFinal(status)) stillPending.push({ o, tn });
          } catch { stillPending.push({ o, tn }); }
        }
        // Phase 2 — statut réel depuis le tableau Ozon (parcels_json). Ozon exige une
        // correspondance EXACTE : on envoie plusieurs candidats par colis (code, variante
        // avec 0, téléphone) et on retient le 1er qui remonte un statut. Appels groupés.
        if (stillPending.length) {
          try {
            // On cherche UNIQUEMENT par CODE de colis (identifiant unique + variantes du 0).
            // Le téléphone est volontairement exclu : un client peut avoir plusieurs colis
            // (livré / échange / retour) et une recherche par numéro renverrait un statut ambigu.
            const jobs = stillPending.map(({ o, tn }) => {
              const cands = new Set([tn]);
              const m = tn.match(/^([A-Za-z]+)(\d+)$/);
              if (m) cands.add(`${m[1]}0${m[2]}`);
              if (/^\d+$/.test(tn) && !tn.startsWith('0')) cands.add('0' + tn);
              return { o, cands: [...cands].filter(c => /^[A-Za-z0-9]{3,30}$/.test(c)) };
            });
            const allCodes = [...new Set(jobs.flatMap(j => j.cands))];
            const byCode = new Map();
            for (let i = 0; i < allCodes.length; i += 30) {
              const chunk = allCodes.slice(i, i + 30);
              const r = await fetch(`/api/ozone-status?codes=${encodeURIComponent(chunk.join(','))}`,
                session?.access_token ? { headers: { Authorization: `Bearer ${session.access_token}` } } : undefined);
              if (!r.ok) continue;
              const d = await r.json();
              (d.results || []).forEach(x => { if (x.status) byCode.set(x.q, x.status); });
            }
            for (const { o, cands } of jobs) {
              let status = null;
              for (const c of cands) { const s = byCode.get(c); if (s) { status = s; break; } }
              if (status && status !== o.ozoneLastStatus) {
                setOrders(prev => prev.map(x => x.id === o.id ? { ...x, ozoneLastStatus: status } : x));
                supabase.from('orders').update({ ozone_last_status: status }).eq('id', o.id).then(() => {});
              }
            }
          } catch {}
        }
      } catch {}
    }
    const timer = setTimeout(syncOzoneStatuses, 5000);
    const interval = setInterval(syncOzoneStatuses, 300000);
    return () => { clearTimeout(timer); clearInterval(interval); };
    // Ne dépend que de la session : on lit les commandes via ordersRef pour éviter de
    // relancer une synchro complète à chaque changement du nombre de commandes.
  }, [session]);

  /* ── Auto-synchro des statuts Chic Affiliate (avant tout return conditionnel) ──
     Passe les commandes « Envoyée » à « Livrée » quand Chic les marque
     livrées, sans clic manuel. */
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    async function syncChic() {
      try {
        if (!getChicConfig()?.sessionCookie) return;
        if (!ordersRef.current.some(o => o.status === 'chic_envoye')) return;
        const chicOrders = await fetchChicRecentOrders(100);
        if (cancelled || !chicOrders.length) return;
        setOrdersWithSync(prev => {
          const updates = computeChicStatusUpdates(chicOrders, prev);
          if (!updates.length) return prev;
          const m = new Map(updates.map(u => [u.id, u.status]));
          const ts = new Date().toLocaleString('fr-MA');
          return prev.map(o => m.has(o.id) ? { ...o, status: m.get(o.id), dateUpdated: ts, manuallyModified: true } : o);
        });
      } catch (e) {
        logAlert('Sync Chic', `Échec de la synchro automatique : ${e?.message || 'erreur'}`);
      }
    }
    syncChic();
    const interval = setInterval(syncChic, 5 * 60 * 1000);
    const onVis = () => { if (document.visibilityState === 'visible') syncChic(); };
    document.addEventListener('visibilitychange', onVis);
    const onChicExpired = () => logAlert('Chic Affiliate', 'Session expirée — reconnectez-vous (Configuration).');
    window.addEventListener('chic-session-expired', onChicExpired);
    return () => { cancelled = true; clearInterval(interval); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('chic-session-expired', onChicExpired); };
  }, [session]);

  /* ── Show loading / login ── */
  if (session === undefined) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (session === null) return <LoginPage />;

  /* ── Supabase helpers ── */
  async function saveOrdersToSupabase(newOrders) {
    if (!newOrders.length) return;
    // Résurrection : seules les commandes dont l'id était supprimé doivent écraser leur ligne.
    // Les autres NE doivent PAS écraser une commande active existante (protège les statuts).
    const resurrectIds = new Set();
    newOrders.forEach(o => { if (deletedIdsRef.current.delete(o.id)) resurrectIds.add(o.id); });
    if (resurrectIds.size) {
      try { localStorage.setItem('deleted_order_ids', JSON.stringify([...deletedIdsRef.current])); } catch {}
    }
    const toRow = (o) => ({
      id: o.id,
      recipient: o.recipient,
      product: o.product,
      products: o.products || null,
      price: o.price,
      status: o.status,
      note: o.note,
      date_added: o.dateAdded,
      date_updated: o.dateUpdated,
      validated: o.validated,
      echange: o.echange || false,
      report_date: o.reportDate || null,
      note_livraison: o.noteLivraison || '',
      tracking_number: o.trackingNumber || null,
      is_deleted: false,
    });
    // Hors ligne : mettre les nouvelles commandes en file d'attente (rejouées au retour du réseau)
    if (!navigator.onLine) {
      await saveOrdersOffline(newOrders);
      for (const o of newOrders) await queueSync('update', o);
      return;
    }
    const fresh = newOrders.filter(o => !resurrectIds.has(o.id)).map(toRow);
    const resurrected = newOrders.filter(o => resurrectIds.has(o.id)).map(toRow);
    // fresh : ignoreDuplicates protège une éventuelle commande active portant le même id
    if (fresh.length) {
      const { error } = await supabase.from('orders').upsert(fresh, { onConflict: 'id', ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    }
    // resurrected : écrase la ligne soft-deleted pour la réactiver
    if (resurrected.length) {
      const { error } = await supabase.from('orders').upsert(resurrected, { onConflict: 'id' });
      if (error) throw new Error(error.message);
    }
  }

  async function deleteOrderFromSupabase(orderId) {
    deletedIdsRef.current.add(orderId);
    if (!navigator.onLine) {
      await queueSync('delete', { id: orderId });
      await deleteOrderOffline(orderId);
      return;
    }
    /* Soft delete — mark the row instead of removing it so it survives cache resets */
    const { error } = await supabase.from('orders').update({ is_deleted: true }).eq('id', orderId);
    if (error) { try { await queueSync('delete', { id: orderId }); } catch {} }
  }

  /* Corbeille : récupère les commandes soft-deleted (les plus récentes d'abord) */
  async function fetchDeletedOrders() {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('is_deleted', true)
      .order('date_updated', { ascending: false })
      .limit(100);
    if (error) { logError('Corbeille', error.message); return []; }
    return (data || []).map(mapRow);
  }

  /* Restaure une commande supprimée : is_deleted=false + retrait de la liste noire */
  async function restoreOrder(orderId) {
    deletedIdsRef.current.delete(orderId);
    try { localStorage.setItem('deleted_order_ids', JSON.stringify([...deletedIdsRef.current])); } catch {}
    const { data, error } = await supabase
      .from('orders')
      .update({ is_deleted: false })
      .eq('id', orderId)
      .select()
      .single();
    if (error) { logError('Restauration', error.message); return false; }
    if (data) setOrders(prev => prev.some(o => o.id === orderId) ? prev : [mapRow(data), ...prev]);
    return true;
  }

  async function updateOrderInSupabase(order) {
    if (!navigator.onLine) {
      await queueSync('update', order);
      await saveOrdersOffline([order]);
      return;
    }
    const { error } = await supabase.from('orders').upsert({
      id: order.id,
      status: order.status,
      note: order.note,
      validated: order.validated,
      recipient: order.recipient,
      product: order.product,
      products: order.products || null,
      price: order.price,
      date_added: order.dateAdded,
      date_updated: new Date().toLocaleString('fr-MA'),
      echange: order.echange || false,
      report_date: order.reportDate || null,
      note_livraison: order.noteLivraison || '',
      tracking_number: order.trackingNumber || null,
      manually_modified: order.manuallyModified || false,
      ...(order.ozoneTracking ? { ozone_tracking: order.ozoneTracking } : {}),
      ...(order.ozoneLastStatus ? { ozone_last_status: order.ozoneLastStatus } : {}),
    }, { onConflict: 'id' });
    // Écriture en ligne échouée (RLS, réseau transitoire…) : on met la mutation en file
    // pour rejouer, sinon le changement local ne rejoindrait jamais la base.
    if (error) { try { await queueSync('update', order); } catch {} }
  }

  const setOrdersWithSync = (updater) => {
    setOrders((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const prevMap = new Map(prev.map(o => [o.id, o]));
      const brandNew = next.filter(o => !prevMap.has(o.id));
      const changed = next.filter((o) => {
        const old = prevMap.get(o.id);
        if (!old) return false;
        return o.status !== old.status || o.note !== old.note || o.validated !== old.validated
          || o.price !== old.price || o.trackingNumber !== old.trackingNumber
          || o.ozoneTracking !== old.ozoneTracking || o.recipient !== old.recipient
          || o.product !== old.product || o.echange !== old.echange
          || o.reportDate !== old.reportDate || o.noteLivraison !== old.noteLivraison
          || o.ozoneLastStatus !== old.ozoneLastStatus;
      });
      if (brandNew.length) saveOrdersToSupabase(brandNew).catch(e => console.error('save new orders:', e));
      changed.forEach((o) => {
        modifiedIdsRef.current.add(o.id);
        updateOrderInSupabase({ ...o, manuallyModified: true });
      });
      // Cache updated orders to IndexedDB
      saveOrdersOffline(next).catch(e => console.error('Failed to cache orders offline:', e));
      return next;
    });
  };

  function handleWooImport(newOrders) {
    setOrders((prev) => {
      const existingIds = new Set(prev.map((o) => o.id));
      const fresh = newOrders.filter((o) => !existingIds.has(o.id));
      if (fresh.length) saveOrdersToSupabase(fresh);
      return fresh.length ? [...fresh, ...prev] : prev;
    });
    navigate('/commandes/a-confirmer');
  }

  return (
    <ToastProvider>
    <PermissionsProvider session={session}>
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <Sidebar orders={orders} session={session} />
      <main className="flex-1 min-w-0 overflow-auto flex flex-col">
        {offline && (
          <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center gap-2 text-xs text-yellow-800 shrink-0">
            <span>📡 وضع بدون إنترنت — التغييرات غادي تتزامن ملي ترجع الشبكة</span>
          </div>
        )}
        {(wooError || dbError) && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center justify-between text-xs text-red-700 shrink-0">
            <span>🔴 {dbError || wooError}</span>
            <button onClick={() => { setDbError(null); setWooError(null); setIsLoading(true); window.location.reload(); }} className="ml-2 px-2 py-0.5 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700">Réessayer</button>
            <button onClick={() => { setWooError(null); setDbError(null); }} className="ml-2 text-red-400 hover:text-red-600 font-bold">✕</button>
          </div>
        )}
        <div className="flex-1 min-w-0 overflow-auto" ref={scrollContainerRef}>
        <ScrollToTop scrollRef={scrollContainerRef} />
        <ErrorBoundary>
        <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>}>
        <div className="page-enter h-full">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard orders={orders} isLoading={isLoading} />} />
          <Route path="/analytics" element={<AnalyticsPage orders={orders} />} />
          <Route path="/commandes" element={<Navigate to="/commandes/a-confirmer" replace />} />
          <Route path="/commandes/:tab" element={<OrdersRoute orders={orders} setOrdersWithSync={setOrdersWithSync} isLoading={isLoading} onDeleteOrder={(id) => { setOrders(prev => prev.filter(o => o.id !== id)); deleteOrderFromSupabase(id); }} currentUser={session?.user?.email || 'inconnu'} />} />
          <Route path="/liste-colis" element={<ListeColisPage orders={orders} setOrders={setOrdersWithSync} isLoading={isLoading} onDeleteOrder={(id) => { setOrders(prev => prev.filter(o => o.id !== id)); deleteOrderFromSupabase(id); }} fetchDeletedOrders={fetchDeletedOrders} restoreOrder={restoreOrder} />} />
          <Route path="/import-sheets" element={<GoogleSheetsPage orders={orders} setOrders={setOrdersWithSync} />} />
          <Route path="/stock" element={<PermGate perm="stock"><StockPage /></PermGate>} />
          <Route path="/chic-affiliate" element={<ChicAffiliatePage orders={orders} setOrders={setOrdersWithSync} onDeleteOrder={(id) => { setOrders(prev => prev.filter(o => o.id !== id)); deleteOrderFromSupabase(id); }} currentUser={session?.user?.email || 'inconnu'} />} />
          <Route path="/ramassage" element={<Navigate to="/ramassage/scanner" replace />} />
          <Route path="/ramassage/scanner" element={<PermGate perm="ramassage"><RamassagePage orders={orders} setOrders={setOrdersWithSync} /></PermGate>} />
          <Route path="/ramassage/bons" element={<PermGate perm="ramassage"><RamassagePage orders={orders} setOrders={setOrdersWithSync} /></PermGate>} />
          <Route path="/ramassage/bon/:bonId" element={<PermGate perm="ramassage"><RamassagePage orders={orders} setOrders={setOrdersWithSync} /></PermGate>} />
          <Route path="/retour" element={<Navigate to="/retour/scanner" replace />} />
          <Route path="/retour/scanner" element={<PermGate perm="retour"><RetourPage orders={orders} setOrders={setOrdersWithSync} /></PermGate>} />
          <Route path="/retour/bons" element={<PermGate perm="retour"><RetourPage orders={orders} setOrders={setOrdersWithSync} /></PermGate>} />
          <Route path="/retour/bon/:bonId" element={<PermGate perm="retour"><RetourPage orders={orders} setOrders={setOrdersWithSync} /></PermGate>} />
          <Route path="/factures" element={<PermGate perm="factures"><FacturesPage orders={orders} /></PermGate>} />
          <Route path="/profit" element={<PermGate perm="profit"><ProfitPage orders={orders} /></PermGate>} />
          <Route path="/etats" element={<PermGate perm="etats"><EtatsPage /></PermGate>} />
          <Route path="/livraison" element={<PermGate perm="livraison"><LivraisonPage /></PermGate>} />
          <Route path="/moderateurs" element={<ModeratorsPage />} />
          <Route path="/reglage" element={<PermGate perm="reglages"><SettingsPage onWooOrdersImported={handleWooImport} orders={orders} setOrders={setOrdersWithSync} /></PermGate>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </div>
        </Suspense>
        </ErrorBoundary>
        </div>
      </main>
      <IOSInstallPrompt />
      <OfflineBanner />
      <PWAUpdateBanner />
    </div>
    </PermissionsProvider>
    </ToastProvider>
  );
}
