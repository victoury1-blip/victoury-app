import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import OrdersPage from './components/OrdersPage';
import Dashboard from './components/Dashboard';
import SettingsPage from './components/SettingsPage';
import EtatsPage from './components/EtatsPage';
import LivraisonPage from './components/LivraisonPage';
import ListeColisPage from './components/ListeColisPage';
import StockPage from './components/StockPage';
import FacturesPage from './components/FacturesPage';
import ProfitPage from './components/ProfitPage';
import RamassagePage from './components/RamassagePage';
import RetourPage from './components/RetourPage';
import LoginPage from './components/LoginPage';
import ModeratorsPage from './components/ModeratorsPage';
import { supabase } from './lib/supabase';
import { cloudGet } from './lib/cloudSettings';
import ErrorBoundary from './components/ErrorBoundary';
import { PermissionsProvider, usePermissions } from './lib/permissions';

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

export default function App() {
  const [session, setSession] = useState(undefined);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWooFetching, setIsWooFetching] = useState(true);
  const [wooError, setWooError] = useState(null);
  const [dbError, setDbError] = useState(null);
  const modifiedIdsRef = useRef(new Set());
  const deletedIdsRef = useRef(new Set());
  const wooConfigRef = useRef(null);
  const notifConfigRef = useRef(null);
  const navigate = useNavigate();

  /* ── Auth ── */
  useEffect(() => {
    const timeout = setTimeout(() => setSession(null), 5000);
    supabase.auth.getSession().then(({ data }) => { clearTimeout(timeout); setSession(data.session ?? null); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

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
          .neq('is_deleted', true)
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
        setIsLoading(false);
        return;
      }
      /* Build blacklist from soft-deleted rows — survives cache resets */
      const { data: delRows } = await supabase.from('orders').select('id').eq('is_deleted', true);
      const deletedIds = (delRows || []).map(r => r.id);
      deletedIdsRef.current = new Set(deletedIds);
      localStorage.setItem('deleted_order_ids', JSON.stringify(deletedIds));
      setOrders(data.map((o) => ({
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
      })));
      setIsLoading(false);
    }
    load();
  }, [session]);

  /* ── Error logger → Supabase error_logs table ── */
  function logError(source, message, details = {}) {
    supabase.from('error_logs').insert({ source, message, details }).then(({ error }) => {
      if (error) console.error('[logError] failed to write to error_logs:', error.message);
    });
  }

  /* ── WC sync logger ── */
  function logWcSync(entry) {
    const MAX = 100;
    supabase.from('settings').select('value').eq('key', 'wc_sync_logs').single().then(({ data }) => {
      const logs = Array.isArray(data?.value) ? data.value : [];
      const next = [{ ...entry, ts: new Date().toISOString() }, ...logs].slice(0, MAX);
      supabase.from('settings').upsert({ key: 'wc_sync_logs', value: next, updated_at: new Date().toISOString() }, { onConflict: 'key' }).then(() => {});
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
            `/wc-api/wp-json/wc/v3/orders?status=processing,pending&per_page=50&consumer_key=${config.consumerKey}&consumer_secret=${config.consumerSecret}`,
            { signal: controller.signal }
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
              status: 'nouveau',
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
            /* Play notification sound */
            try {
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
            if (!wc || wc.price === o.price) return o;
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
        const toSync = orders.filter(o => o.validated && (o.ozoneTracking || o.trackingNumber));
        for (const o of toSync) {
          const tn = o.ozoneTracking || o.trackingNumber || o.id;
          try {
            const body = new FormData();
            body.append('tracking-number', tn);
            const res = await fetch(`${base}/tracking`, { method: 'POST', body });
            if (!res.ok) continue;
            const json = await res.json();
            const track = json?.['TRACKING'] || json || {};
            if ((track['RESULT'] || '').toUpperCase() === 'ERROR') continue;
            const last = track['LAST_TRACKING'] || track['LAST-TRACKING'] || {};
            const status = last['STATUT'] || last['STATUS'] || '';
            if (status && status !== o.ozoneLastStatus) {
              setOrders(prev => prev.map(x => x.id === o.id ? { ...x, ozoneLastStatus: status } : x));
              supabase.from('orders').update({ ozone_last_status: status }).eq('id', o.id).then(() => {});
            }
          } catch {}
        }
      } catch {}
    }
    const timer = setTimeout(syncOzoneStatuses, 5000);
    const interval = setInterval(syncOzoneStatuses, 300000);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [session, orders.length]);

  /* ── Show loading / login ── */
  if (session === undefined) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (session === null) return <LoginPage />;

  /* ── Supabase helpers ── */
  async function saveOrdersToSupabase(newOrders) {
    if (!newOrders.length) return;
    const filtered = newOrders.filter(o => !deletedIdsRef.current.has(o.id));
    if (!filtered.length) return;
    const rows = filtered.map((o) => ({
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
    }));
    const { error } = await supabase.from('orders').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }

  async function deleteOrderFromSupabase(orderId) {
    /* Soft delete — mark the row instead of removing it so it survives cache resets */
    await supabase.from('orders').update({ is_deleted: true }).eq('id', orderId);
    deletedIdsRef.current.add(orderId);
  }

  async function updateOrderInSupabase(order) {
    await supabase.from('orders').upsert({
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
    <PermissionsProvider session={session}>
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <Sidebar orders={orders} />
      <main className="flex-1 overflow-auto flex flex-col">
        {(wooError || dbError) && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center justify-between text-xs text-red-700 shrink-0">
            <span>🔴 {dbError || wooError}</span>
            <button onClick={() => { setDbError(null); setWooError(null); setIsLoading(true); window.location.reload(); }} className="ml-2 px-2 py-0.5 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700">Réessayer</button>
            <button onClick={() => { setWooError(null); setDbError(null); }} className="ml-2 text-red-400 hover:text-red-600 font-bold">✕</button>
          </div>
        )}
        <div className="flex-1 overflow-auto">
        <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard orders={orders} />} />
          <Route path="/commandes" element={<Navigate to="/commandes/a-confirmer" replace />} />
          <Route path="/commandes/:tab" element={<OrdersRoute orders={orders} setOrdersWithSync={setOrdersWithSync} isLoading={isLoading || isWooFetching} onDeleteOrder={(id) => { setOrders(prev => prev.filter(o => o.id !== id)); deleteOrderFromSupabase(id); }} currentUser={session?.user?.email || 'inconnu'} />} />
          <Route path="/liste-colis" element={<ListeColisPage orders={orders} setOrders={setOrdersWithSync} isLoading={isLoading || isWooFetching} />} />
          <Route path="/stock" element={<PermGate perm="stock"><StockPage /></PermGate>} />
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
        </ErrorBoundary>
        </div>
      </main>
    </div>
    </PermissionsProvider>
  );
}
