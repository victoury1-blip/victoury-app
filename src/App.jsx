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
const FournisseurPage = React.lazy(() => import('./components/FournisseurPage'));
const ChicAffiliatePage = React.lazy(() => import('./components/ChicAffiliatePage'));
const FacturesPage = React.lazy(() => import('./components/FacturesPage'));
const ProfitPage = React.lazy(() => import('./components/ProfitPage'));
const RamassagePage = React.lazy(() => import('./components/RamassagePage'));
const AnalyticsPage = React.lazy(() => import('./components/AnalyticsPage'));
const RetourPage = React.lazy(() => import('./components/RetourPage'));
const AssistantWidget = React.lazy(() => import('./components/AssistantWidget'));
const ModeratorsPage = React.lazy(() => import('./components/ModeratorsPage'));
import { supabase } from './lib/supabase';
const _offlineStore = () => import('./lib/offlineStore');
const saveOrdersOffline = async (...a) => (await _offlineStore()).saveOrdersOffline(...a);
const loadOrdersOffline = async (...a) => (await _offlineStore()).loadOrdersOffline(...a);
const queueSync = async (...a) => (await _offlineStore()).queueSync(...a);
const getPendingSync = async (...a) => (await _offlineStore()).getPendingSync(...a);
const deleteSyncItem = async (...a) => (await _offlineStore()).deleteSyncItem(...a);
const deleteOrderOffline = async (...a) => (await _offlineStore()).deleteOrderOffline(...a);
const replaceOrdersOffline = async (...a) => (await _offlineStore()).replaceOrdersOffline(...a);
import { fetchFingerprints, fetchAllOrders, fetchOrdersByIds, staleIds } from './lib/ordersSync';
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
import { generateVictId, isVictCode } from './lib/victId';
import { now, fmtDate } from './lib/dateUtils';

/** Attribue un code VICTxxxx aux commandes fraîchement importées, pour qu'une
 *  nouvelle commande porte son numéro dès son entrée dans À Confirmer. L'id interne
 *  reste WC-xxxx (déduplication) ; l'affichage utilise `trackingNumber || id`.
 *  SÉCURITÉ : on ne numérote pas tant que la liste complète n'est pas chargée,
 *  sinon le compteur serait calculé sur une liste vide (risque de doublons). */
/** Parse une date applicative « JJ/MM/AAAA HH:mm(:ss) » -> timestamp (0 si invalide). */
function parseAppDate(str) {
  const m = String(str || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  return m ? new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime() : 0;
}

function assignVictTracking(freshOrders, allOrders) {
  if (!allOrders || !allOrders.length) return freshOrders;
  freshOrders.forEach((o) => {
    // Présence d'un code, pas sa forme : même règle que partout ailleurs, pour
    // qu'un code du transporteur (WC-…, MIMA…) ne soit jamais recouvert.
    if (String(o.trackingNumber || '').trim() || isVictCode(o.id)) return;
    o.trackingNumber = generateVictId(allOrders);
  });
  return freshOrders;
}

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
    recipient: o.recipient || {},
    product: o.product || {},
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
    createdAt: o.created_at || null,
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
  // Initialisée dès le premier rendu depuis le localStorage : sinon un import
  // WooCommerce déclenché avant la fin du chargement ressuscite des commandes
  // supprimées.
  const deletedIdsRef = useRef(new Set((() => {
    try { return JSON.parse(localStorage.getItem('deleted_order_ids') || '[]'); } catch { return []; }
  })()));
  const initialLoadDoneRef = useRef(false);
  // Version « état » du drapeau : un ref ne déclenche pas de re-rendu, donc
  // l'effet de sondage ne repartirait jamais une fois le chargement terminé.
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  // id -> timestamp du dernier changement LOCAL. Pendant une courte fenêtre, une
  // re-synchro (focus) ou un événement Realtime ne doit PAS écraser une commande
  // modifiée localement mais pas encore confirmée en base (sinon l'édition « revient »).
  const recentEditsRef = useRef(new Map());
  const wooConfigRef = useRef(null);
  // Un aléa réseau isolé (30s de polling) ne doit pas afficher un bandeau rouge
  // à chaque fois : on n'alerte qu'après 2 échecs CONSÉCUTIFS.
  const wooFailCountRef = useRef(0);
  /* Prochain instant où réessayer WooCommerce. Boutique injoignable, le sondage
     repartait toutes les 45 s : chaque tentative attend 9 s pour rien, écrit une
     ligne d'erreur en base et fait clignoter le bandeau. L'attente double après
     chaque échec, jusqu'à 30 min. */
  const wooNextTryRef = useRef(0);
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
        // Purge des éléments trop anciens (> 24 h) : ils ne représentent plus l'état
        // voulu et ne feraient que ressusciter d'anciennes valeurs.
        const DAY = 24 * 60 * 60 * 1000;
        const fresh = [];
        for (const item of pending) {
          const t = Number(item.timestamp || 0);
          if (t && Date.now() - t > DAY) { try { await deleteSyncItem(item.id); } catch {} }
          else fresh.push(item);
        }
        for (const item of fresh) {
          try {
            let error = null;
            if (item.action === 'update') {
              const o = item.data;
              // GARDE-FOU : ne pas rejouer un instantané PÉRIMÉ. Si la ligne en base a
              // été modifiée après cet élément de file, le rejouer écraserait la valeur
              // récente par une ancienne (c'est ainsi que d'anciens codes de suivi
              // « revenaient » après chaque rechargement).
              const { data: cur } = await supabase.from('orders')
                .select('date_updated').eq('id', o.id).maybeSingle();
              // Date de l'instantané : celle de la commande, ou à défaut l'heure de
              // mise en file (sinon un format de date inattendu vaut 0 et l'élément
              // serait rejeté — ou pire, rejoué — à tort).
              const snapTs = parseAppDate(o.dateUpdated) || item.timestamp || 0;
              const curTs = cur?.date_updated ? parseAppDate(cur.date_updated) : 0;
              if (curTs && snapTs && curTs > snapTs) {
                await deleteSyncItem(item.id);
                continue;
              }
              const r = await supabase.from('orders').upsert({
                id: o.id, status: o.status, note: o.note, validated: o.validated,
                recipient: o.recipient || {}, product: o.product || {}, products: o.products || null,
                price: o.price, date_added: o.dateAdded,
                // On rejoue l'instantané AVEC SA DATE : l'horodater à « maintenant »
                // ferait passer un contenu ancien pour le plus récent, et la
                // prochaine re-synchro le préférerait à la valeur réelle.
                date_updated: o.dateUpdated || now(),
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
      'victoury_manual_facture',
    ];
    // NB: 'victoury_sent_livreur' et 'victoury_recu_ids' sont volontairement EXCLUS.
    // Ce sont des ensembles alimentés côté client (colis « info envoyée » / « reçu »).
    // Les précharger ici écraserait (setItem direct) les ajouts locaux récents pas
    // encore synchronisés -> l'état « Envoyé » disparaissait après un refresh.
    // ListeColisPage les charge lui-même avec une FUSION (merge) qui préserve le local.
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

  /* ── Chargement des commandes : cache local d'abord, puis delta ──
   *
   * L'application relisait TOUTES les commandes (des milliers de lignes avec
   * leurs objets `recipient` / `products`) à l'ouverture ET à chaque retour au
   * premier plan. C'est ce qui épuisait le quota de bande passante de la base.
   *
   * Le même effet couvre maintenant le premier chargement ET le rattrapage au
   * retour au premier plan : les deux passent par la comparaison d'empreintes,
   * il n'y a donc plus qu'un seul chemin à maintenir. */
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    let syncing = false;
    let lastSync = 0;

    /* Les versions précédentes du cache omettaient certaines colonnes (`recu`,
       `created_at`). On l'ignore tant qu'il n'a pas été réécrit au format
       courant, sinon ces champs reviendraient vides. */
    const CACHE_VERSION = '2';

    /* Applique l'état du serveur en ne remplaçant que ce qui a bougé.
       `fpRows` = empreintes de TOUTES les lignes ; `fetched` = lignes
       complètes rapatriées ; `cachedById` = ce qu'on avait déjà. */
    function apply(fpRows, fetched, cachedById) {
      const fullById = new Map(fetched.map(r => [r.id, mapRow(r)]));
      /* Liste noire : elle se déduit de la MÊME requête que les empreintes —
         l'ancienne requête séparée sur les commandes supprimées disparaît.
         Une ligne redevenue active fait foi : une commande restaurée via la
         Corbeille sort de la liste noire, même si un autre appareil garde
         encore son id en localStorage (sinon la restauration ne « tient » pas). */
      const activeIds = new Set(fpRows.filter(r => !r.is_deleted).map(r => r.id));
      let localBlacklist = [];
      try { localBlacklist = JSON.parse(localStorage.getItem('deleted_order_ids') || '[]'); } catch { /* cache vide */ }
      const deletedIds = [...new Set([
        ...fpRows.filter(r => r.is_deleted).map(r => r.id),
        ...localBlacklist,
      ])].filter(id => !activeIds.has(id));
      deletedIdsRef.current = new Set(deletedIds);
      try { localStorage.setItem('deleted_order_ids', JSON.stringify(deletedIds)); } catch { /* quota */ }

      const rows = fpRows
        .filter(r => !r.is_deleted && !deletedIdsRef.current.has(r.id))
        .map(r => fullById.get(r.id) || cachedById.get(r.id))
        .filter(Boolean);

      /* FUSION (et non remplacement) : on garde la version LOCALE des commandes
         éditées il y a moins de 15 s — mutation encore en vol, pas confirmée en
         base — sinon la synchro ferait « revenir » l'édition à l'ancienne valeur. */
      const GRACE = 15000;
      const nowTs = Date.now();
      let committed = rows;
      setOrders(prev => {
        const prevMap = new Map(prev.map(o => [o.id, o]));
        const fetchedIds = new Set(rows.map(o => o.id));
        const merged = rows.map(o => {
          const editedAt = recentEditsRef.current.get(o.id);
          return editedAt && nowTs - editedAt < GRACE && prevMap.has(o.id) ? prevMap.get(o.id) : o;
        });
        // Conserver en tête les commandes locales récentes absentes du serveur
        // (créées localement, pas encore en base) pour ne pas les perdre.
        const localOnly = prev.filter(o => {
          if (fetchedIds.has(o.id) || deletedIdsRef.current.has(o.id)) return false;
          const editedAt = recentEditsRef.current.get(o.id);
          return editedAt && nowTs - editedAt < GRACE;
        });
        const seen = new Set();
        committed = [...localOnly, ...merged].filter(o => (seen.has(o.id) ? false : seen.add(o.id)));
        return committed;
      });
      // Le cache est REMPLACÉ : sans cela les commandes supprimées y restaient
      // et ressortaient au démarrage suivant.
      replaceOrdersOffline(committed)
        .then(() => { try { localStorage.setItem('orders_cache_version', CACHE_VERSION); } catch { /* quota */ } })
        .catch(e => console.error('Failed to cache orders offline:', e));
    }

    /* Synchro par empreintes : 7 petites colonnes pour toutes les lignes, puis
       rapatriement complet des SEULES commandes qui ont changé. Quand rien n'a
       bougé — le cas courant — le transfert s'arrête à l'empreinte. */
    async function delta(cachedById) {
      const fp = await fetchFingerprints(supabase);
      if (fp.error) return false;
      const ids = staleIds(fp.rows.filter(r => !r.is_deleted), cachedById);
      let fetched = [];
      if (ids.length) {
        const res = await fetchOrdersByIds(supabase, ids);
        if (res.error) return false;
        fetched = res.rows;
      }
      if (cancelled) return true;
      apply(fp.rows, fetched, cachedById);
      return true;
    }

    /* Cache absent ou périmé : une seule lecture complète, puis on repasse en
       mode delta pour toutes les ouvertures suivantes. */
    async function full(attempt = 0) {
      const res = await fetchAllOrders(supabase);
      if (res.error) {
        if (attempt < 3 && !cancelled) {
          await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
          return full(attempt + 1);
        }
        return false;
      }
      if (cancelled) return true;
      apply(res.rows.map(r => ({ ...r, is_deleted: false })), res.rows, new Map());
      return true;
    }

    async function sync(force = false) {
      if (syncing || (!force && Date.now() - lastSync < 60000)) return;
      syncing = true;
      try {
        const cached = localStorage.getItem('orders_cache_version') === CACHE_VERSION
          ? await loadOrdersOffline().catch(() => [])
          : [];
        const ok = cached.length
          ? await delta(new Map(cached.map(o => [o.id, o])))
          : await full();
        if (ok) {
          lastSync = Date.now();
          /* Le sondage WooCommerce N'EST autorisé qu'après une lecture réussie :
             lancé sur une liste incomplète, il prend chaque commande pour une
             nouvelle et lui réattribue un code de suivi. */
          initialLoadDoneRef.current = true;
          setInitialLoadDone(true);
        } else if (!initialLoadDoneRef.current) {
          setDbError('⚠️ Erreur Supabase : impossible de charger les commandes');
          if (cached.length) {
            setOrders(cached);
            setDbError(prev => prev + ' — données hors-ligne chargées');
          }
        }
      } catch (e) {
        console.error('[sync] échec de la synchronisation des commandes:', e);
      } finally {
        syncing = false;
        setIsLoading(false);
      }
    }

    // Affichage IMMÉDIAT depuis le cache : l'application est utilisable avant
    // même la première réponse du serveur.
    (async () => {
      try {
        if (localStorage.getItem('orders_cache_version') !== CACHE_VERSION) return;
        const cached = await loadOrdersOffline();
        if (!cancelled && cached.length) { setOrders(cached); setIsLoading(false); }
      } catch (e) {
        console.error('Failed to load offline orders:', e);
      } finally {
        if (!cancelled) sync(true);
      }
    })();

    /* Rattrapage au retour au premier plan : le Realtime ne fonctionne que tant
       que l'onglet est actif ; en arrière-plan sur mobile la connexion se coupe
       et les changements faits ailleurs sont MANQUÉS. */
    const onVis = () => { if (document.visibilityState === 'visible') sync(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
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
        // NE PAS ressusciter une commande supprimée sur un update anodin
        // (changement de statut, synchro Ozon, écho d'un ré-enregistrement…).
        // La restauration se fait uniquement via la Corbeille (restoreOrder),
        // qui met déjà l'état local à jour et retire l'id de la liste noire.
        if (deletedIdsRef.current.has(o.id)) return;
        // Ignorer l'écho d'une édition LOCALE récente (< 15 s) : le payload distant
        // peut être plus ancien que notre état local et « écraserait » l'édition en
        // cours (y compris des champs que l'autre appareil n'a pas touchés).
        const editedAt = recentEditsRef.current.get(o.id);
        if (editedAt && Date.now() - editedAt < 15000) return;
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

  /* ── Rattrapage : une commande « À Confirmer » SANS AUCUN code en reçoit un ──
     Le test porte sur l'ABSENCE de code, pas sur sa forme : après un alignement
     sur Ozon, beaucoup de commandes portent un code du transporteur (WC-1959,
     MIMA2125…) qui n'a pas la forme VICTxxxx. Les considérer comme « sans code »
     leur réattribuait un VICTOURY à chaque chargement — les codes importés
     d'Ozon semblaient donc revenir en arrière après chaque rafraîchissement.
     Aucune commande déjà numérotée n'est touchée. Une seule passe par chargement. */
  const victFillRef = useRef(false);
  useEffect(() => {
    if (!session || !orders.length || victFillRef.current) return;
    const missing = orders
      .filter(o => o.status === 'nouveau' && !String(o.trackingNumber || '').trim() && !isVictCode(o.id))
      .sort((a, b) => parseAppDate(a.dateAdded) - parseAppDate(b.dateAdded));
    if (!missing.length) return;
    victFillRef.current = true;
    (async () => {
      try {
        const assign = new Map();
        for (const o of missing) assign.set(o.id, generateVictId(orders));
        const entries = [...assign.entries()];
        const BATCH = 20;
        for (let i = 0; i < entries.length; i += BATCH) {
          await Promise.all(entries.slice(i, i + BATCH).map(([id, vict]) =>
            supabase.from('orders').update({ tracking_number: vict }).eq('id', id)
              .then(({ error }) => { if (error) logError('vict_fill', `${id} : ${error.message}`); })
              .catch(() => {})
          ));
        }
        setOrders(prev => prev.map(o => assign.has(o.id) ? { ...o, trackingNumber: assign.get(o.id) } : o));
      } catch { /* on NE réarme PAS : un nouvel essai risquerait d'attribuer des
                   codes en double. Le rattrapage se refera au prochain démarrage. */ }
    })();
  }, [session, orders.length]);

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

  /* ── WooCommerce polling ──
     ATTEND que les commandes soient chargées depuis Supabase. Sans cela, le
     sondage pouvait s'exécuter alors que la liste locale était encore vide :
     toutes les commandes WooCommerce paraissaient alors NOUVELLES, recevaient
     un code de suivi tout neuf et étaient réenregistrées par-dessus l'existant.
     C'est ainsi que des codes déjà déposés chez le transporteur se retrouvaient
     remplacés par des VICTOURY fraîchement émis, à chaque rechargement. */
  useEffect(() => {
    if (!session || !initialLoadDone) return;
    /* Attente avant la prochaine tentative : 45 s, puis 1 min 30, 3 min… et au
       plus 30 min. Une boutique en panne n'est pas réparée par l'insistance. */
    const backoff = () => {
      wooNextTryRef.current = Date.now()
        + Math.min(30 * 60000, 45000 * 2 ** Math.max(0, wooFailCountRef.current - 1));
    };
    async function fetchWooOrders(manual = false) {
      // Boutique injoignable : on espace les tentatives au lieu d'insister
      // toutes les 45 s. Le bouton « Réessayer » force le passage.
      if (!manual && Date.now() < wooNextTryRef.current) return;
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
        // Récupération côté SERVEUR (fonction /api/woo-orders) : bien plus fiable
        // que le navigateur → rewrite → boutique (évite « Failed to fetch », CORS,
        // suppression d'en-têtes). Repli sur le rewrite direct si l'API échoue.
        const WC_TIMEOUT = 25000;
        /* Une lecture via notre fonction serveur, pour un nombre de commandes
           donné. Séparée en fonction pour pouvoir RÉESSAYER plus petit : quand
           la boutique met plus de 9 s à répondre, c'est le volume demandé qui
           est en cause bien plus souvent que la panne. */
        async function callWooApi(perPage) {
          const { data: { session } } = await supabase.auth.getSession();
          const controller = new AbortController();
          const to = setTimeout(() => controller.abort(), WC_TIMEOUT + 3000);
          let apiRes;
          try {
            apiRes = await fetch('/api/woo-orders', {
              method: 'POST',
              signal: controller.signal,
              headers: {
                'Content-Type': 'application/json',
                ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
              },
              body: JSON.stringify({ siteUrl: config.siteUrl || 'https://victoury-maroc.com', consumerKey: config.consumerKey, consumerSecret: config.consumerSecret, perPage }),
            });
          } finally { clearTimeout(to); }
          const ct = apiRes.headers.get('content-type') || '';
          // Une réponse NON-JSON avec un statut d'erreur veut dire que la requête
          // n'a même pas atteint notre fonction serveur (bloquée en amont, ex.
          // pare-feu / protection anti-bot Vercel) : le message « vérifiez vos
          // clés » serait trompeur, la config WooCommerce n'y est pour rien.
          if (!apiRes.ok && !ct.includes('json')) {
            throw new Error(`Requête bloquée avant le serveur (HTTP ${apiRes.status}) — vérifiez le pare-feu/la protection Vercel du projet`);
          }
          const j = await apiRes.json().catch(() => ({}));
          if (!apiRes.ok) {
            const err = new Error(j.error || `API ${apiRes.status}`);
            err.wooTimeout = !!j.timeout;
            throw err;
          }
          return j.orders || [];
        }
        let data;
        try {
          try {
            data = await callWooApi(50);
          } catch (firstErr) {
            // Repli sur un lot réduit : les commandes sont triées de la plus
            // récente à la plus ancienne, donc les nouvelles restent couvertes.
            if (!firstErr?.wooTimeout) throw firstErr;
            data = await callWooApi(10);
          }
        } catch (apiErr) {
          // Repli : appel direct via le rewrite Vercel (query-string + header).
          // Un AbortError renvoie le message brut du navigateur (« signal is
          // aborted without reason ») : on le reformule pour rester lisible.
          /* Le message doit désigner la BOUTIQUE : les deux voies (fonction
             serveur et appel direct) partent d'ici, donc un échec des deux vient
             du site WordPress, pas de l'application ni des clés API. */
          const friendly = (err) => {
            if (err?.name === 'AbortError') return 'la boutique n’a pas répondu à temps';
            return err?.message || 'erreur réseau';
          };
          const wcHeaders = { Authorization: 'Basic ' + btoa(`${config.consumerKey}:${config.consumerSecret}`) };
          const wcAuthQs = `consumer_key=${encodeURIComponent(config.consumerKey)}&consumer_secret=${encodeURIComponent(config.consumerSecret)}`;
          const controller = new AbortController();
          const to = setTimeout(() => controller.abort(), WC_TIMEOUT);
          let res;
          try {
            // Lot réduit : cette voie ne sert que lorsque la boutique répond mal,
            // lui redemander 50 commandes garantissait un second échec.
            res = await fetch(`/wc-api/wp-json/wc/v3/orders?status=processing,pending&per_page=10&orderby=date&order=desc&_fields=id,number,status,date_created,date_modified,total,billing,line_items,customer_note&${wcAuthQs}`, { signal: controller.signal, headers: wcHeaders });
          } catch (directErr) {
            // Les deux voies ont échoué : afficher le message le plus utile
            // (celui de l'API serveur, qui explique la vraie cause).
            wooFailCountRef.current += 1;
            backoff();
            if (wooFailCountRef.current >= 2) {
              const slow = apiErr?.wooTimeout || directErr?.name === 'AbortError';
              setWooError('⚠️ WooCommerce: ' + (friendly(apiErr) || friendly(directErr) || 'connexion impossible')
                + (slow ? ' — le site victoury-maroc.com est trop lent, à voir avec l’hébergeur' : ''));
            }
            return;
          } finally { clearTimeout(to); }
          if (!res.ok) {
            wooFailCountRef.current += 1;
            backoff();
            if (wooFailCountRef.current >= 2) setWooError('⚠️ WooCommerce: ' + (friendly(apiErr) || 'erreur ' + res.status) + ' — vérifiez vos clés API');
            return;
          }
          data = await res.json();
        }
        wooFailCountRef.current = 0;
        wooNextTryRef.current = 0;
        setWooError(null);
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
              dateAdded: fmtDate(o.date_created),
              dateUpdated: fmtDate(o.date_modified),
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
            assignVictTracking(fresh, prev); // code VICT dès l'entrée
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
            // UPDATE (jamais upsert) : un upsert créerait une ligne fantôme sans
            // statut ni destinataire si la commande n'existe pas encore en base.
            supabase.from('orders').update({ price: o.price, product: o.product, products: o.products }).eq('id', o.id)
              .then(({ error }) => { if (error) logError('supabase_price_update', `Failed to update price for ${o.id}: ${error.message}`, { order_id: o.id, error: error.message }); })
          );
          /* Log success */
          if (fresh.length || changedWC.length) logWcSync({ status: 'success', newOrders: fresh.length, updatedOrders: changedWC.length });
          return fresh.length ? [...fresh, ...updated] : updated;
        });
      } catch (e) {
        const isTimeout = e?.name === 'AbortError';
        const msg = isTimeout ? 'serveur WooCommerce lent (délai dépassé) — réessai automatique' : (e?.message || 'erreur réseau');
        wooFailCountRef.current += 1;
        backoff();
        if (wooFailCountRef.current >= 2) setWooError('⚠️ WooCommerce: ' + msg);
        logWcSync({ status: 'error', error: msg });
        logError('wc_poll', msg, { timeout: isTimeout });
      } finally {
        setIsWooFetching(false);
      }
    }
    fetchWooOrders();
    const interval = setInterval(fetchWooOrders, 45000);
    return () => clearInterval(interval);
  }, [session, initialLoadDone]);

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
        // Ne jamais régresser un statut FINAL (Livré/Retourné/Refusé) vers un non-final :
        // l'API officielle Ozon renvoie parfois un ancien « Attente ramassage » qui
        // écraserait à tort un « Livré » déjà confirmé par le tableau de bord.
        const shouldApply = (cur, next) => !!next && next !== cur && !(isFinal(cur) && !isFinal(next));
        const applyStatus = (o, status) => {
          if (!shouldApply(o.ozoneLastStatus, status)) return;
          setOrders(prev => prev.map(x => x.id === o.id ? { ...x, ozoneLastStatus: status } : x));
          supabase.from('orders').update({ ozone_last_status: status }).eq('id', o.id)
            .then(({ error }) => { if (error) console.warn('[ozon] statut non enregistré:', o.id, error.message); });
        };
        // UNIQUEMENT les livraisons Ozon : interroger Ozon pour une commande confiée à
        // un livreur personnel lui collait un statut Ozon (« Livré ») qui n'a aucun sens.
        const toSync = ordersRef.current.filter(o =>
          o.validated && (o.ozoneTracking || o.trackingNumber) && /ozon/i.test(o.recipient?.delivery || ''));
        // Phase 1 — API officielle de suivi (par numéro, avec variantes du 0).
        const stillPending = [];
        for (const o of toSync) {
          // Le code affiché prime : une correction manuelle doit être suivie.
          const tn = o.trackingNumber || o.ozoneTracking || o.id;
          try {
            let status = await trackByNumber(tn);
            if (!status) {
              const variants = [];
              const m = tn.match(/^([A-Za-z]+)(\d+)$/);
              if (m) variants.push(`${m[1]}0${m[2]}`);          // MIMA3251 → MIMA03251
              if (/^\d+$/.test(tn) && !tn.startsWith('0')) variants.push('0' + tn);
              for (const v of variants) { status = await trackByNumber(v); if (status) break; }
            }
            applyStatus(o, status);
            // Un statut déjà FINAL (côté commande ou déjà enregistré) ne nécessite pas
            // de re-vérification par le tableau de bord.
            if (!isFinal(status) && !isFinal(o.ozoneLastStatus)) stillPending.push({ o, tn });
          } catch { if (!isFinal(o.ozoneLastStatus)) stillPending.push({ o, tn }); }
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
              applyStatus(o, status);
            }
          } catch {}
        }
      } catch {}
    }
    const timer = setTimeout(syncOzoneStatuses, 5000);
    const interval = setInterval(syncOzoneStatuses, 300000);
    // Aussi au retour au premier plan (plus réactif que d'attendre 5 min).
    const onVis = () => { if (document.visibilityState === 'visible') syncOzoneStatuses(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearTimeout(timer); clearInterval(interval); document.removeEventListener('visibilitychange', onVis); };
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
          const ts = now();
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
    // Les commandes supprimées (liste noire) restent supprimées : un ré-import ne doit PAS
    // les recréer. La restauration se fait uniquement via la Corbeille (restoreOrder).
    newOrders = newOrders.filter(o => !deletedIdsRef.current.has(o.id));
    if (!newOrders.length) return;
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
    // ignoreDuplicates protège une éventuelle commande active existante (statuts, etc.).
    const { error } = await supabase.from('orders').upsert(newOrders.map(toRow), { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }

  async function deleteOrderFromSupabase(orderId) {
    deletedIdsRef.current.add(orderId);
    // Persiste immédiatement la liste noire : indispensable pour les commandes WC-xxxx
    // qui n'ont pas de ligne Supabase — sinon le polling WooCommerce les ré-ajoute.
    try { localStorage.setItem('deleted_order_ids', JSON.stringify([...deletedIdsRef.current])); } catch {}
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

  /* Suppression DÉFINITIVE depuis la Corbeille : retire la ligne de Supabase et de la
     liste noire (irréversible). Utilisé pour purger des commandes non désirées. */
  async function purgeOrder(orderId) {
    const { error } = await supabase.from('orders').delete().eq('id', orderId);
    if (error) { logError('Suppression définitive', error.message); return false; }
    deletedIdsRef.current.delete(orderId);
    try { localStorage.setItem('deleted_order_ids', JSON.stringify([...deletedIdsRef.current])); } catch {}
    setOrders(prev => prev.filter(o => o.id !== orderId));
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
      // Utiliser la date de màj DÉJÀ posée localement (par le changement de statut)
      // pour que la valeur en base == la valeur locale : la signature de re-synchro
      // reste stable et on évite un remplacement inutile au prochain focus.
      date_updated: order.dateUpdated || now(),
      echange: order.echange || false,
      report_date: order.reportDate || null,
      note_livraison: order.noteLivraison || '',
      tracking_number: order.trackingNumber || null,
      recu: order.recu ?? false,
      manually_modified: order.manuallyModified || false,
      ...(order.ozoneTracking ? { ozone_tracking: order.ozoneTracking } : {}),
      ...(order.ozoneLastStatus ? { ozone_last_status: order.ozoneLastStatus } : {}),
    }, { onConflict: 'id' });
    // Écriture en ligne échouée (RLS, réseau transitoire…) : on met la mutation en file
    // pour rejouer, sinon le changement local ne rejoindrait jamais la base.
    if (error) {
      // L'échec ne doit plus être invisible : sans cela, une modification semble
      // enregistrée puis « revient » au rechargement (rien n'a été écrit en base).
      logError('Enregistrement commande', `${order.id} : ${error.message}`);
      try { await queueSync('update', order); } catch {}
    }
  }

  /* Point d'écriture PRINCIPAL de l'application.
     L'updater fonctionnel est OBLIGATOIRE ici : lui seul reçoit l'état le plus
     récent de React. Repartir d'une copie mémorisée (ordersRef) réécrasait les
     valeurs arrivées entre-temps par Realtime ou re-synchro — c'est ainsi que
     des corrections manuelles « revenaient » à leur ancienne valeur. */
  const setOrdersWithSync = (updater) => {
    setOrders((prev) => {
      let next = typeof updater === 'function' ? updater(prev) : updater;
      const prevIds = new Set(prev.map(o => o.id));
      // Ne jamais réintroduire une commande supprimée (liste noire) via un ré-import :
      // on ne garde une commande absente de `prev` que si elle n'est pas en liste noire.
      next = next.filter(o => prevIds.has(o.id) || !deletedIdsRef.current.has(o.id));
      // Dédoublonnage par id : une même commande ne doit JAMAIS figurer deux fois
      // dans l'état (sinon elle s'affiche/compte en double et paraît « en doublon »).
      { const seen = new Set(); next = next.filter(o => (seen.has(o.id) ? false : seen.add(o.id))); }
      const prevMap = new Map(prev.map(o => [o.id, o]));
      const brandNew = next.filter(o => !prevMap.has(o.id));
      const changed = next.filter((o) => {
        const old = prevMap.get(o.id);
        if (!old) return false;
        return o.status !== old.status || o.note !== old.note || o.validated !== old.validated
          || o.price !== old.price || o.trackingNumber !== old.trackingNumber
          || o.ozoneTracking !== old.ozoneTracking || o.recipient !== old.recipient
          || o.product !== old.product || o.products !== old.products || o.echange !== old.echange
          || o.reportDate !== old.reportDate || o.noteLivraison !== old.noteLivraison
          || o.recu !== old.recu || o.ozoneLastStatus !== old.ozoneLastStatus;
      });
      if (brandNew.length) saveOrdersToSupabase(brandNew).catch(e => console.error('save new orders:', e));
      const editTs = Date.now();
      brandNew.forEach(o => recentEditsRef.current.set(o.id, editTs));
      changed.forEach((o) => {
        modifiedIdsRef.current.add(o.id);
        recentEditsRef.current.set(o.id, editTs); // protège l'édition d'un écrasement par un refetch/Realtime
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
      // Ne pas ressusciter une commande supprimée (WC-xxxx notamment) via un import manuel.
      const fresh = newOrders.filter((o) => !existingIds.has(o.id) && !deletedIdsRef.current.has(o.id));
      if (fresh.length) { assignVictTracking(fresh, prev); saveOrdersToSupabase(fresh); }
      return fresh.length ? [...fresh, ...prev] : prev;
    });
    navigate('/commandes/a-confirmer');
  }

  return (
    <ToastProvider>
    <PermissionsProvider session={session}>
    {/* pt-safe : avec viewport-fit=cover (iOS), la page passe SOUS la barre
        d'état — bandeaux et bouton menu se retrouvaient par-dessus l'heure et
        la batterie. La hauteur reste celle de l'écran (box-border). */}
    <div className="flex h-screen bg-gray-100 overflow-hidden pt-[env(safe-area-inset-top)]">
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
          <Route path="/liste-colis" element={<ListeColisPage orders={orders} setOrders={setOrdersWithSync} isLoading={isLoading} onDeleteOrder={(id) => { setOrders(prev => prev.filter(o => o.id !== id)); deleteOrderFromSupabase(id); }} fetchDeletedOrders={fetchDeletedOrders} restoreOrder={restoreOrder} purgeOrder={purgeOrder} />} />
          <Route path="/import-sheets" element={<GoogleSheetsPage orders={orders} setOrders={setOrdersWithSync} />} />
          <Route path="/stock" element={<PermGate perm="stock"><StockPage /></PermGate>} />
          <Route path="/fournisseur" element={<PermGate perm="stock"><FournisseurPage /></PermGate>} />
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
      <React.Suspense fallback={null}><AssistantWidget orders={orders} /></React.Suspense>
    </div>
    </PermissionsProvider>
    </ToastProvider>
  );
}
