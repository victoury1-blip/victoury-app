import React, { useMemo } from 'react';
import useCountUp from '../hooks/useCountUp';
import {
  ShoppingCart, CheckCircle, Clock, RotateCcw, TrendingUp,
  Package, XCircle, Truck, DollarSign, RefreshCw,
  Star, AlertTriangle, Users, ArrowRight, ArrowUpRight, ArrowDownRight, Minus, Store,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/* Photo de profil dans l'en-tête du Dashboard (clic -> ouvre la fiche profil
   gérée par la Sidebar via un événement). Reste en place, sans chevauchement. */
function ProfilePhoto() {
  let profile = {};
  try { profile = JSON.parse(localStorage.getItem('victoury_profile') || '{}'); } catch {}
  return (
    <button
      onClick={() => window.dispatchEvent(new Event('open-profile'))}
      className="shrink-0 rounded-full shadow-md hover:shadow-lg transition ring-2 ring-white"
      title="Profil"
    >
      {profile.avatar ? (
        <img src={profile.avatar} alt="" className="w-12 h-12 rounded-full object-cover" />
      ) : (
        <div className="w-12 h-12 rounded-full bg-gray-800 text-white flex items-center justify-center text-lg font-bold">
          {(profile.name || 'V')[0]?.toUpperCase()}
        </div>
      )}
    </button>
  );
}
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import useProducts from '../hooks/useProducts';

/* ── date helpers ── */
function parseDate(str) {
  if (!str) return null;
  const [d, m, y, hm] = str.split(/[/ ]/);
  const [h, min] = (hm || '00:00').split(':');
  return new Date(y, m - 1, d, h, min);
}

function startOf(date, unit) {
  const d = new Date(date);
  if (unit === 'day')  { d.setHours(0,0,0,0); return d; }
  if (unit === 'week') { d.setHours(0,0,0,0); d.setDate(d.getDate() - d.getDay()); return d; }
  if (unit === 'month'){ d.setHours(0,0,0,0); d.setDate(1); return d; }
  return d;
}

function filterByPeriod(orders, period) {
  const now = new Date();
  const todayStart  = startOf(now, 'day');
  const weekStart   = startOf(now, 'week');
  const monthStart  = startOf(now, 'month');
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayEnd   = new Date(todayStart);

  return orders.filter(o => {
    const d = parseDate(o.dateAdded);
    if (!d) return period === 'all';
    if (period === 'today')     return d >= todayStart;
    if (period === 'yesterday') return d >= yesterdayStart && d < yesterdayEnd;
    if (period === 'week')      return d >= weekStart;
    if (period === 'month')     return d >= monthStart;
    return true;
  });
}

const STATUS_LABELS = {
  nouveau: 'Nouveau', confirme: 'Confirmé', livre: 'Livré', refuse: 'Refusé',
  annule: 'Annulé', reporter: 'Reporté', en_suivi: 'En suivi',
  att_ramassage: 'Att. ramassage', expedier: 'Expédié', recu_livreur: 'Reçu livreur',
  pret_retour: 'Prêt retour', retour_recu: 'Retour reçu',
};

const STATUS_COLORS = {
  nouveau: 'bg-blue-100 text-blue-700', confirme: 'bg-green-100 text-green-700',
  livre: 'bg-emerald-100 text-emerald-700', refuse: 'bg-red-100 text-red-700',
  annule: 'bg-gray-100 text-gray-600', reporter: 'bg-orange-100 text-orange-700',
  en_suivi: 'bg-purple-100 text-purple-700', att_ramassage: 'bg-amber-100 text-amber-700',
};

/* ── Skeleton loader ── */
function DashboardSkeleton() {
  return (
    <div className="p-4 sm:p-6 space-y-6 bg-gray-50 min-h-full animate-pulse">
      <div>
        <div className="h-7 w-48 bg-gray-200 rounded-lg" />
        <div className="h-4 w-64 bg-gray-200 rounded-lg mt-2" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-32 bg-gray-200 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 bg-gray-200 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-64 bg-gray-200 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

/* ── KPI card ── */
const KpiCard = React.memo(function KpiCard({ icon: Icon, label, value, sub, iconBg, trend }) {
  const numericTarget = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^\d.]/g, '')) || 0;
  const animated = useCountUp(numericTarget);

  // Flash vert quand la valeur augmente (nouvelle commande en temps réel)
  const prevRef = React.useRef(numericTarget);
  const [bump, setBump] = React.useState(false);
  React.useEffect(() => {
    if (numericTarget > prevRef.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 1300);
      prevRef.current = numericTarget;
      return () => clearTimeout(t);
    }
    prevRef.current = numericTarget;
  }, [numericTarget]);
  const displayValue = typeof value === 'number'
    ? Math.round(animated).toLocaleString('fr-MA')
    : String(value).replace(/[\d,.]+/, Math.round(animated).toLocaleString('fr-MA'));

  const trendEl = trend != null && trend !== 0 ? (
    <span className={`flex items-center gap-0.5 text-xs font-bold ${trend > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
      {trend > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {Math.abs(trend)}%
    </span>
  ) : trend === 0 ? (
    <span className="flex items-center gap-0.5 text-xs font-bold text-gray-400"><Minus size={13} /> 0%</span>
  ) : null;

  return (
    <div className={`bg-white rounded-2xl shadow-sm border p-5 flex flex-col gap-3 hover:shadow-md transition-all duration-500 animate-fade-in ${bump ? 'border-emerald-300 ring-2 ring-emerald-200 bg-emerald-50/40' : 'border-gray-100'}`}>
      <div className="flex items-start justify-between">
        <div className={`${iconBg} p-3 rounded-xl`}>
          <Icon size={20} className="text-white" />
        </div>
        {trendEl}
      </div>
      <div>
        <p className="text-2xl font-black text-gray-900 leading-tight">{displayValue}</p>
        <p className="text-xs font-medium text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
});

/* ── Period summary card ── */
const PeriodCard = React.memo(function PeriodCard({ label, dateHint, orders, bgClass }) {
  const ca = orders.reduce((s, o) => s + (o.price || 0), 0);
  const total = orders.length;
  return (
    <div className={`${bgClass} rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden select-none animate-fade-in`}>
      <ShoppingCart size={72} className="absolute right-3 bottom-2 opacity-10 text-white" />
      <div className="flex items-center justify-between">
        <span className="text-white font-bold text-sm">{label}</span>
        {dateHint && <span className="text-white/70 text-xs font-medium">{dateHint}</span>}
      </div>
      <div className="flex items-center gap-1.5">
        <DollarSign size={18} className="text-white/80 shrink-0" />
        <span className="text-white font-black text-2xl leading-none">
          {Math.floor(ca).toLocaleString('fr-MA')}
          <span className="text-base font-bold">.{String(Math.round((ca % 1) * 100)).padStart(2,'0')}</span>
          <span className="text-sm font-semibold ml-1 opacity-80">DH</span>
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <ShoppingCart size={18} className="text-white/80 shrink-0" />
        <span className="text-white font-black text-2xl leading-none">{total.toLocaleString('fr-MA')}</span>
      </div>
    </div>
  );
});

/* ── Status row ── */
const StatusRow = React.memo(function StatusRow({ label, count, amount, color }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-sm text-gray-700">{label}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm font-bold text-gray-800 w-8 text-right">{count}</span>
        {amount !== undefined && (
          <span className="text-sm text-gray-500 w-28 text-right">{amount.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} DH</span>
        )}
      </div>
    </div>
  );
});

export default function Dashboard({ orders = [], isLoading = false }) {
  const navigate = useNavigate();
  const now = new Date();
  const weekStart = startOf(now, 'week');
  const MONTH_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  function fmtDate(d) { return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`; }

  const todayOrders = useMemo(() => filterByPeriod(orders, 'today'), [orders]);

  const ca = orders.filter(o => ['confirme','livre'].includes(o.status)).reduce((s, o) => s + (o.price || 0), 0);
  const livreCA = orders.filter(o => o.status === 'livre').reduce((s, o) => s + (o.price || 0), 0);

  const counts = {
    total: orders.length,
    nouveau: orders.filter(o => o.status === 'nouveau').length,
    confirme: orders.filter(o => o.status === 'confirme').length,
    livre: orders.filter(o => o.status === 'livre').length,
    refuse: orders.filter(o => o.status === 'refuse').length,
    annule: orders.filter(o => o.status === 'annule').length,
    reporter: orders.filter(o => o.status === 'reporter').length,
    en_suivi: orders.filter(o => o.status === 'en_suivi').length,
    att_ram: orders.filter(o => o.status === 'att_ramassage').length,
    expedier: orders.filter(o => o.status === 'expedier').length,
  };

  const retourCA = orders.filter(o => ['refuse','annule','retour','pret_retour'].includes(o.status)).reduce((s, o) => s + (o.price || 0), 0);
  const tauxRetour = counts.total > 0 ? Math.round(((counts.refuse + counts.annule) / counts.total) * 100) : 0;
  const taux = counts.total > 0 ? Math.round((counts.livre / counts.total) * 100) : 0;

  const yesterdayOrders = useMemo(() => filterByPeriod(orders, 'yesterday'), [orders]);

  const daily = useMemo(() => {
    const todayConfirm = todayOrders.filter(o => ['confirme','livre'].includes(o.status)).length;
    const yestConfirm = yesterdayOrders.filter(o => ['confirme','livre'].includes(o.status)).length;
    const todayLivre = counts.livre;
    const yestLivre = yesterdayOrders.filter(o => o.status === 'livre').length;
    const todayRefuse = counts.refuse + counts.annule;
    const yestRefuse = yesterdayOrders.filter(o => ['refuse','annule'].includes(o.status)).length;
    const todayCA = ca;
    const yestCA = yesterdayOrders.filter(o => ['confirme','livre'].includes(o.status)).reduce((s, o) => s + (o.price || 0), 0);
    return { todayConfirm, yestConfirm, todayLivre, yestLivre, todayRefuse, yestRefuse, todayCA, yestCA };
  }, [todayOrders, yesterdayOrders, counts, ca]);

  const periodSummaries = useMemo(() => [
    { label: "Aujourd'hui", dateHint: fmtDate(now), orders: filterByPeriod(orders, 'today'), bgClass: 'bg-gradient-to-br from-blue-500 to-blue-600' },
    { label: 'Hier', dateHint: fmtDate(new Date(now.getTime()-86400000)), orders: filterByPeriod(orders, 'yesterday'), bgClass: 'bg-gradient-to-br from-slate-500 to-slate-600' },
    { label: 'Cette semaine', dateHint: `depuis ${fmtDate(weekStart)}`, orders: filterByPeriod(orders, 'week'), bgClass: 'bg-gradient-to-br from-cyan-500 to-sky-600' },
    { label: 'Ce mois', dateHint: MONTH_FR[now.getMonth()], orders: filterByPeriod(orders, 'month'), bgClass: 'bg-gradient-to-br from-teal-500 to-emerald-600' },
    { label: 'Total', dateHint: null, orders, bgClass: 'bg-gradient-to-br from-orange-500 to-orange-600' },
  ], [orders]);

  function trendPct(today, yesterday) {
    if (yesterday === 0) return today > 0 ? 100 : null;
    return Math.round(((today - yesterday) / yesterday) * 100);
  }

  const kpis = [
    { icon: ShoppingCart, label: 'Total commandes', value: counts.total, iconBg: 'bg-blue-500', sub: `${counts.nouveau} nouvelles`, trend: trendPct(todayOrders.length, yesterdayOrders.length) },
    { icon: CheckCircle, label: 'Confirmées', value: counts.confirme, iconBg: 'bg-green-500', sub: `${counts.en_suivi} en suivi`, trend: trendPct(daily.todayConfirm, daily.yestConfirm) },
    { icon: Truck, label: 'Livrées', value: counts.livre, iconBg: 'bg-emerald-500', sub: `Taux: ${taux}%`, trend: trendPct(daily.todayLivre, daily.yestLivre) },
    { icon: XCircle, label: 'Refusées / Annulées', value: counts.refuse + counts.annule, iconBg: 'bg-red-500', sub: `${counts.refuse} ref, ${counts.annule} ann`, trend: trendPct(daily.todayRefuse, daily.yestRefuse) },
    { icon: RotateCcw, label: 'Reportées', value: counts.reporter, iconBg: 'bg-orange-500', sub: `${counts.expedier} expédié, ${counts.att_ram} att. ram.` },
    { icon: DollarSign, label: "Chiffre d'affaires", value: `${ca.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} DH`, iconBg: 'bg-purple-500', sub: `Livré: ${livreCA.toLocaleString('fr-MA',{minimumFractionDigits:2})} DH`, trend: trendPct(daily.todayCA, daily.yestCA) },
  ];

  /* ── Chic Affiliate stats ── */
  const { products: chicProducts } = useProducts(p => p.source === 'chic-affiliate');

  const chicStats = useMemo(() => {
    const chicNames = new Set(chicProducts.map(p => p.name?.toLowerCase()).filter(Boolean));

    const chicOrders = orders.filter(o => {
      const prods = o.products || [o.product];
      return (prods || []).some(p => p?.name && chicNames.has(p.name.toLowerCase()));
    });

    const todayChic = chicOrders.filter(o => {
      const d = parseDate(o.dateAdded);
      return d && d >= startOf(new Date(), 'day');
    });

    const todayCA = todayChic.filter(o => ['confirme', 'livre'].includes(o.status))
      .reduce((s, o) => s + (o.price || 0), 0);

    const todayCost = todayChic.filter(o => ['confirme', 'livre'].includes(o.status)).reduce((s, o) => {
      const prods = o.products || [o.product];
      let cost = 0;
      (prods || []).forEach(p => {
        if (!p?.name) return;
        const sp = chicProducts.find(sp => sp.name?.toLowerCase() === p.name.toLowerCase());
        if (sp) cost += parseFloat(sp.prixAchat || sp.purchasePrice || 0) * (p.qty || 1);
      });
      return s + cost;
    }, 0);

    return {
      productCount: chicProducts.length,
      todayOrders: todayChic.length,
      todayCA,
      todayProfit: todayCA - todayCost,
    };
  }, [orders, chicProducts]);

  const statusRows = [
    { label: 'Nouveau (À confirmer)', count: counts.nouveau, amount: orders.filter(o=>o.status==='nouveau').reduce((s,o)=>s+(o.price||0),0), color: 'bg-blue-400' },
    { label: 'Confirmé', count: counts.confirme, amount: orders.filter(o=>o.status==='confirme').reduce((s,o)=>s+(o.price||0),0), color: 'bg-green-500' },
    { label: 'Expédié', count: counts.expedier, amount: orders.filter(o=>o.status==='expedier').reduce((s,o)=>s+(o.price||0),0), color: 'bg-blue-500' },
    { label: 'En attente ramassage', count: counts.att_ram, amount: undefined, color: 'bg-amber-400' },
    { label: 'En suivi', count: counts.en_suivi, amount: undefined, color: 'bg-purple-400' },
    { label: 'Livré', count: counts.livre, amount: livreCA, color: 'bg-emerald-500' },
    { label: 'Refusé', count: counts.refuse, amount: orders.filter(o=>o.status==='refuse').reduce((s,o)=>s+(o.price||0),0), color: 'bg-red-500' },
    { label: 'Annulé', count: counts.annule, amount: undefined, color: 'bg-gray-400' },
    { label: 'Reporté', count: counts.reporter, amount: undefined, color: 'bg-orange-400' },
  ].filter(r => r.count > 0);

  /* ── Top Products ── */
  const topProducts = useMemo(() => {
    const map = new Map();
    const monthOrders = filterByPeriod(orders, 'month');
    monthOrders.forEach(o => {
      const prods = o.products || [o.product];
      (prods || []).forEach(p => {
        if (!p?.name) return;
        const key = p.name;
        const prev = map.get(key) || { name: key, qty: 0, revenue: 0 };
        prev.qty += (p.qty || 1);
        prev.revenue += (o.price || 0);
        map.set(key, prev);
      });
    });
    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [orders]);

  /* ── Livreur Performance ── */
  const livreurStats = useMemo(() => {
    const map = new Map();
    orders.forEach(o => {
      const liv = o.recipient?.delivery;
      if (!liv) return;
      const prev = map.get(liv) || { name: liv, total: 0, livre: 0, refuse: 0, revenue: 0 };
      prev.total++;
      if (o.status === 'livre') { prev.livre++; prev.revenue += (o.price || 0); }
      if (['refuse','annule','retour','pret_retour'].includes(o.status)) prev.refuse++;
      map.set(liv, prev);
    });
    return [...map.values()].filter(l => l.total >= 5).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [orders]);

  /* ── Recent Orders ── */
  const recentOrders = useMemo(() => {
    return [...orders]
      .sort((a, b) => {
        const da = parseDate(a.dateAdded);
        const db = parseDate(b.dateAdded);
        return (db?.getTime() || 0) - (da?.getTime() || 0);
      })
      .slice(0, 8);
  }, [orders]);

  /* ── Alerts ── */
  const alerts = useMemo(() => {
    const list = [];
    const pending = orders.filter(o => o.status === 'nouveau');
    if (pending.length > 10) list.push({ text: `${pending.length} commandes en attente de confirmation`, type: 'warning', action: '/commandes/a-confirmer' });
    const reported = orders.filter(o => o.status === 'reporter');
    if (reported.length > 0) {
      const overdue = reported.filter(o => {
        if (!o.reportDate) return false;
        return new Date(o.reportDate) <= new Date();
      });
      if (overdue.length) list.push({ text: `${overdue.length} commandes reportées à rappeler aujourd'hui`, type: 'urgent', action: '/commandes/reporter' });
    }
    const noLivreur = orders.filter(o => o.status === 'confirme' && !o.recipient?.delivery);
    if (noLivreur.length) list.push({ text: `${noLivreur.length} commandes confirmées sans livreur`, type: 'warning', action: '/commandes/confirme' });
    return list;
  }, [orders]);

  /* ── Chart data: Sales over last 14 days ── */
  const salesChartData = useMemo(() => {
    const days = [];
    const todayD = startOf(new Date(), 'day');
    for (let i = 13; i >= 0; i--) {
      const d = new Date(todayD);
      d.setDate(d.getDate() - i);
      days.push({ date: d, revenue: 0, count: 0 });
    }
    orders.forEach(o => {
      if (!['confirme', 'livre'].includes(o.status)) return;
      const d = parseDate(o.dateAdded);
      if (!d) return;
      const dStart = startOf(d, 'day').getTime();
      const match = days.find(day => day.date.getTime() === dStart);
      if (match) {
        match.revenue += o.price || 0;
        match.count += 1;
      }
    });
    return days.map(d => ({
      name: `${String(d.date.getDate()).padStart(2, '0')}/${String(d.date.getMonth() + 1).padStart(2, '0')}`,
      revenue: Math.round(d.revenue),
      count: d.count,
    }));
  }, [orders]);

  /* ── Chart data: Status distribution this month ── */
  const STATUS_CHART_COLORS = {
    nouveau: '#3b82f6', confirme: '#22c55e', livre: '#10b981', refuse: '#ef4444',
    annule: '#6b7280', reporter: '#f97316', en_suivi: '#a855f7', att_ramassage: '#f59e0b',
    expedier: '#0ea5e9', recu_livreur: '#06b6d4', pret_retour: '#f43f5e', retour_recu: '#64748b',
  };

  const statusChartData = useMemo(() => {
    const monthOrders = filterByPeriod(orders, 'month');
    const cts = {};
    monthOrders.forEach(o => { cts[o.status] = (cts[o.status] || 0) + 1; });
    return Object.entries(cts)
      .filter(([, v]) => v > 0)
      .map(([status, count]) => ({
        name: STATUS_LABELS[status] || status,
        count,
        fill: STATUS_CHART_COLORS[status] || '#94a3b8',
      }));
  }, [orders]);

  if (isLoading && orders.length === 0) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-gray-50 min-h-full">
      {/* Header — la photo de profil occupe la place de l'ancien « En direct ». */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Tableau de bord</h1>
          <p className="text-sm text-gray-500 mt-0.5">Vue d'ensemble de votre activité</p>
        </div>
        <ProfilePhoto />
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <button key={i} onClick={() => navigate(a.action)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors text-left ${
                a.type === 'urgent' ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100' : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
              }`}>
              <AlertTriangle size={16} className="shrink-0" />
              <span className="flex-1">{a.text}</span>
              <ArrowRight size={14} className="shrink-0 opacity-50" />
            </button>
          ))}
        </div>
      )}

      {/* Period summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {periodSummaries.map(p => <PeriodCard key={p.label} {...p} />)}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map(k => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* Chic Affiliate stats */}
      {chicStats.productCount > 0 && (
        <div className="bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <Store size={72} className="absolute right-3 bottom-2 opacity-10 text-white" />
          <div className="flex items-center gap-2 mb-3">
            <Store size={18} className="text-white" />
            <span className="text-white font-bold text-sm">Chic Affiliate</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-white/70 text-xs">Produits importés</p>
              <p className="text-white font-black text-2xl">{chicStats.productCount}</p>
            </div>
            <div>
              <p className="text-white/70 text-xs">Commandes aujourd'hui</p>
              <p className="text-white font-black text-2xl">{chicStats.todayOrders}</p>
            </div>
            <div>
              <p className="text-white/70 text-xs">CA aujourd'hui</p>
              <p className="text-white font-black text-2xl">{chicStats.todayCA.toLocaleString('fr-MA')} <span className="text-sm font-bold">DH</span></p>
            </div>
            <div>
              <p className="text-white/70 text-xs">Bénéfice aujourd'hui</p>
              <p className="text-white font-black text-2xl">{chicStats.todayProfit.toLocaleString('fr-MA')} <span className="text-sm font-bold">DH</span></p>
            </div>
          </div>
        </div>
      )}

      {/* Bottom section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Status breakdown */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Package size={16} className="text-blue-500" />
            Répartition par état
          </h2>
          {statusRows.length === 0 ? (
            <div className="py-8 text-center text-gray-300 text-sm">Aucune commande</div>
          ) : statusRows.map(r => <StatusRow key={r.label} {...r} />)}
        </div>

        {/* CA summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col">
          <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-purple-500" />
            Chiffre d'affaires
          </h2>
          <div className="flex flex-col gap-3 flex-1">
            {[
              { label: 'Total confirmées', val: orders.filter(o=>['confirme','livre'].includes(o.status)).reduce((s,o)=>s+(o.price||0),0), color: 'text-green-700', bg: 'bg-green-50' },
              { label: 'Total livrées', val: livreCA, color: 'text-emerald-700', bg: 'bg-emerald-50' },
              { label: 'Retours / Refusés', val: retourCA, color: 'text-red-700', bg: 'bg-red-50' },
              { label: 'En attente', val: orders.filter(o=>['nouveau','reporter','en_suivi','att_ramassage','expedier'].includes(o.status)).reduce((s,o)=>s+(o.price||0),0), color: 'text-amber-700', bg: 'bg-amber-50' },
            ].map(item => (
              <div key={item.label} className={`${item.bg} rounded-xl px-4 py-3`}>
                <p className="text-xs text-gray-500 mb-0.5">{item.label}</p>
                <p className={`text-xl font-black ${item.color}`}>
                  {item.val.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} <span className="text-sm font-bold">DH</span>
                </p>
              </div>
            ))}
            <div className="mt-auto space-y-2">
              <div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>Taux de livraison</span>
                  <span className="font-bold text-green-600">{taux}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="bg-gradient-to-r from-green-400 to-emerald-500 h-2 rounded-full transition-all" style={{ width: `${taux}%` }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>Taux de retour</span>
                  <span className="font-bold text-red-500">{tauxRetour}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="bg-gradient-to-r from-red-400 to-red-500 h-2 rounded-full transition-all" style={{ width: `${tauxRetour}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Star size={16} className="text-amber-500" />
            Top produits du mois
          </h2>
          {topProducts.length === 0 ? (
            <div className="py-8 text-center text-gray-300 text-sm">Aucune donnée</div>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white ${
                    i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-orange-400' : 'bg-gray-300'
                  }`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.qty} vendus</p>
                  </div>
                  <span className="text-sm font-bold text-gray-700">{p.revenue.toLocaleString('fr-MA')} DH</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Second bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent orders */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <Clock size={16} className="text-blue-500" />
              Dernières commandes
            </h2>
            <button onClick={() => navigate('/commandes/a-confirmer')} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              Voir tout <ArrowRight size={12} />
            </button>
          </div>
          {recentOrders.length === 0 ? (
            <div className="py-8 text-center text-gray-300 text-sm">Aucune commande</div>
          ) : (
            <div className="space-y-2">
              {recentOrders.map(o => (
                <div key={o.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-800">#{o.id}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[o.status] || o.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {o.recipient?.name || '—'} • {o.recipient?.city || '—'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-800">{(o.price || 0).toLocaleString('fr-MA')} DH</p>
                    <p className="text-[10px] text-gray-400">{o.dateAdded?.split(' ')[0] || ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Livreur Performance */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Users size={16} className="text-indigo-500" />
            Performance livreurs
          </h2>
          {livreurStats.length === 0 ? (
            <div className="py-8 text-center text-gray-300 text-sm">Aucune donnée</div>
          ) : (
            <div className="space-y-4">
              {livreurStats.map(l => {
                const tauxLiv = l.total > 0 ? Math.round((l.livre / l.total) * 100) : 0;
                const tauxRef = l.total > 0 ? Math.round((l.refuse / l.total) * 100) : 0;
                return (
                  <div key={l.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-800">{l.name}</span>
                      <span className="text-xs text-gray-500">{l.total} colis</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden flex">
                        <div className="bg-emerald-500 h-full transition-all" style={{ width: `${tauxLiv}%` }} />
                        <div className="bg-red-400 h-full transition-all" style={{ width: `${tauxRef}%` }} />
                      </div>
                      <span className="text-xs font-bold text-emerald-600 w-10 text-right">{tauxLiv}%</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                      <span>{l.livre} livrés</span>
                      <span>{l.refuse} retours</span>
                      <span className="ml-auto font-medium text-gray-600">{l.revenue.toLocaleString('fr-MA')} DH</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Graphiques ── */}
      <h2 className="text-lg font-bold text-gray-800 mt-2">Graphiques</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Line chart - Sales over last 14 days */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-gray-800 text-sm mb-4">Ventes des 14 derniers jours</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={salesChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="revenue" name="Revenu (DH)" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="right" type="monotone" dataKey="count" name="Commandes" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Bar chart - Status distribution this month */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-gray-800 text-sm mb-4">Répartition par statut (ce mois)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={statusChartData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
              <Tooltip />
              <Bar dataKey="count" name="Commandes" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
