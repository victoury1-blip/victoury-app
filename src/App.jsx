import React, { useState, useEffect } from 'react';
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
import LoginPage from './components/LoginPage';
import { supabase } from './lib/supabase';
import { cloudGet } from './lib/cloudSettings';

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
  const navigate = useNavigate();

  /* ── Auth ── */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  /* ── Load orders from Supabase ── */
  useEffect(() => {
    if (!session) return;
    async function load() {
      /* Load only non-deleted orders */
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .neq('is_deleted', true)
        .order('created_at', { ascending: false });
      if (error || !data) { setDbError('⚠️ Erreur Supabase: ' + (error?.message || 'impossible de charger les commandes')); setIsLoading(false); return; }
      /* Build blacklist from soft-deleted rows — survives cache resets */
      const { data: delRows } = await supabase.from('orders').select('id').eq('is_deleted', true);
      const deletedIds = (delRows || []).map(r => r.id);
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
        const stored = localStorage.getItem('woo_config');
        const config = stored ? JSON.parse(stored) : (await cloudGet('woo_config') || {});
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
        const deletedIds = new Set(JSON.parse(localStorage.getItem('deleted_order_ids') || '[]'));
        setOrders((prev) => {
          const existingIds = new Set(prev.map((o) => o.id));
          const fresh = mapped.filter((o) => !existingIds.has(o.id) && !deletedIds.has(o.id));
          if (fresh.length) {
            /* Play notification sound */
            try {
              const nc = JSON.parse(localStorage.getItem('notification_sound') || '{}');
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
          /* Update price + products of existing WC orders (to apply discounts / multi-product changes) */
          const priceMap = new Map(mapped.map(m => [m.id, { price: m.price, product: m.product, products: m.products }]));
          const changedWC = [];
          const updated = prev.map(o => {
            if (!o.id.startsWith('WC-')) return o;
            const wc = priceMap.get(o.id);
            if (!wc || (wc.price === o.price && JSON.stringify(wc.products) === JSON.stringify(o.products))) return o;
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
    const interval = setInterval(fetchWooOrders, 10000);
    return () => clearInterval(interval);
  }, [session]);

  /* ── Show loading / login ── */
  if (session === undefined) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (session === null) return <LoginPage />;

  /* ── Supabase helpers ── */
  async function saveOrdersToSupabase(newOrders) {
    if (!newOrders.length) return;
    const deletedIds = new Set(JSON.parse(localStorage.getItem('deleted_order_ids') || '[]'));
    const filtered = newOrders.filter(o => !deletedIds.has(o.id));
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
    /* Update local blacklist immediately */
    const bl = JSON.parse(localStorage.getItem('deleted_order_ids') || '[]');
    if (!bl.includes(orderId)) { bl.push(orderId); localStorage.setItem('deleted_order_ids', JSON.stringify(bl)); }
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
    }, { onConflict: 'id' });
  }

  const setOrdersWithSync = (updater) => {
    setOrders((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const changed = next.filter((o) => {
        const old = prev.find((p) => p.id === o.id);
        return !old || JSON.stringify(old) !== JSON.stringify(o);
      });
      changed.forEach((o) => updateOrderInSupabase(o));
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
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <Sidebar orders={orders} />
      <main className="flex-1 overflow-auto flex flex-col">
        {(wooError || dbError) && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center justify-between text-xs text-red-700 shrink-0">
            <span>🔴 {dbError || wooError}</span>
            <button onClick={() => { setWooError(null); setDbError(null); }} className="ml-4 text-red-400 hover:text-red-600 font-bold">✕</button>
          </div>
        )}
        <div className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard orders={orders} />} />
          <Route path="/commandes" element={<Navigate to="/commandes/a-confirmer" replace />} />
          <Route path="/commandes/:tab" element={<OrdersRoute orders={orders} setOrdersWithSync={setOrdersWithSync} isLoading={isLoading || isWooFetching} onDeleteOrder={(id) => { setOrders(prev => prev.filter(o => o.id !== id)); deleteOrderFromSupabase(id); }} currentUser={session?.user?.email || 'inconnu'} />} />
          <Route path="/liste-colis" element={<ListeColisPage orders={orders} setOrders={setOrdersWithSync} isLoading={isLoading || isWooFetching} />} />
          <Route path="/stock" element={<StockPage />} />
          <Route path="/ramassage" element={<UnderConstruction />} />
          <Route path="/retour" element={<UnderConstruction />} />
          <Route path="/factures" element={<FacturesPage orders={orders} />} />
          <Route path="/profit" element={<ProfitPage orders={orders} />} />
          <Route path="/etats" element={<EtatsPage />} />
          <Route path="/livraison" element={<LivraisonPage />} />
          <Route path="/reglage" element={<SettingsPage onWooOrdersImported={handleWooImport} />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </div>
      </main>
    </div>
  );
}
