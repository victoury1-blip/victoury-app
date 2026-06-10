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

function OrdersRoute({ orders, setOrdersWithSync, isLoading }) {
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
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error || !data) { setDbError('⚠️ Erreur Supabase: ' + (error?.message || 'impossible de charger les commandes')); setIsLoading(false); return; }
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

  /* ── WooCommerce polling ── */
  useEffect(() => {
    if (!session) return;
    async function fetchWooOrders() {
      try {
        const stored = localStorage.getItem('woo_config');
        const config = stored ? JSON.parse(stored) : (await cloudGet('woo_config') || {});
        if (!config.consumerKey || !config.consumerSecret) return;
        const res = await fetch(
          `/wc-api/wp-json/wc/v3/orders?status=processing,pending&per_page=50&consumer_key=${config.consumerKey}&consumer_secret=${config.consumerSecret}`
        );
        if (!res.ok) { setWooError('⚠️ WooCommerce: erreur ' + res.status + ' — vérifiez vos clés API dans Paramètres'); return; }
        setWooError(null);
        const data = await res.json();
        const mapped = data.map((o) => ({
          id: `WC-${o.id}`,
          recipient: {
            name: `${o.billing.first_name} ${o.billing.last_name}`.trim(),
            address: o.billing.address_1 || '',
            city: o.billing.city || '',
            phone: o.billing.phone || '',
            delivery: null,
          },
          product: {
            name: o.line_items?.[0]?.name || 'Produit WC',
            size: o.line_items?.[0]?.meta_data?.find((m) => m.key === 'pa_taille')?.value || '',
            qty: o.line_items?.[0]?.quantity || 1,
            stock: 0,
          },
          price: parseFloat(o.total) || 0,
          status: 'nouveau',
          note: o.customer_note || '',
          dateAdded: new Date(o.date_created).toLocaleString('fr-MA'),
          dateUpdated: new Date(o.date_modified).toLocaleString('fr-MA'),
          validated: false,
        }));
        setOrders((prev) => {
          const existingIds = new Set(prev.map((o) => o.id));
          const fresh = mapped.filter((o) => !existingIds.has(o.id));
          if (fresh.length) saveOrdersToSupabase(fresh);
          return fresh.length ? [...fresh, ...prev] : prev;
        });
      } catch (e) {
        setWooError('⚠️ WooCommerce inaccessible: ' + (e?.message || 'erreur réseau'));
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
    const rows = newOrders.map((o) => ({
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
    }));
    await supabase.from('orders').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
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
          <Route path="/commandes/:tab" element={<OrdersRoute orders={orders} setOrdersWithSync={setOrdersWithSync} isLoading={isLoading || isWooFetching} />} />
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
