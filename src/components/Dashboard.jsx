import React, { useState, useMemo } from 'react';
import {
  ShoppingCart, CheckCircle, Clock, RotateCcw, TrendingUp,
  Package, XCircle, Truck, DollarSign, RefreshCw,
} from 'lucide-react';

/* ── date helpers ── */
function parseDate(str) {
  if (!str) return null;
  // "DD/MM/YYYY HH:MM"
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

const PERIODS = [
  { id: 'today',     label: "Aujourd'hui" },
  { id: 'yesterday', label: 'Hier' },
  { id: 'week',      label: 'Cette semaine' },
  { id: 'month',     label: 'Ce mois' },
  { id: 'all',       label: 'Total' },
];

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
    return true; // all
  });
}

/* ── KPI card ── */
function KpiCard({ icon: Icon, label, value, sub, iconBg, trend }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className={`${iconBg} p-3 rounded-xl`}>
          <Icon size={20} className="text-white" />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${trend >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-black text-gray-900 leading-tight">{value}</p>
        <p className="text-xs font-medium text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

/* ── Status row in summary table ── */
function StatusRow({ label, count, amount, color }) {
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
}

/* ── Compact period summary card (like the reference image) ── */
function PeriodCard({ label, dateHint, orders, bgClass, icon }) {
  const ca   = orders.reduce((s, o) => s + (o.price || 0), 0);
  const total = orders.length;
  return (
    <div className={`${bgClass} rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden select-none`}>
      {/* watermark */}
      <ShoppingCart size={72} className="absolute right-3 bottom-2 opacity-10 text-white" />
      {/* header */}
      <div className="flex items-center justify-between">
        <span className="text-white font-bold text-sm">{label}</span>
        {dateHint && <span className="text-white/70 text-xs font-medium">{dateHint}</span>}
      </div>
      {/* CA */}
      <div className="flex items-center gap-1.5">
        <DollarSign size={18} className="text-white/80 shrink-0" />
        <span className="text-white font-black text-2xl leading-none">
          {Math.floor(ca).toLocaleString('fr-MA')}
          <span className="text-base font-bold">.{String(Math.round((ca % 1) * 100)).padStart(2,'0')}</span>
          <span className="text-sm font-semibold ml-1 opacity-80">DH</span>
        </span>
      </div>
      {/* Orders */}
      <div className="flex items-center gap-1.5">
        <ShoppingCart size={18} className="text-white/80 shrink-0" />
        <span className="text-white font-black text-2xl leading-none">{total.toLocaleString('fr-MA')}</span>
      </div>
    </div>
  );
}

export default function Dashboard({ orders = [] }) {
  const [period, setPeriod] = useState('today');

  const slice = useMemo(() => filterByPeriod(orders, period), [orders, period]);

  const ca = slice.filter(o => ['confirme','livre'].includes(o.status)).reduce((s, o) => s + (o.price || 0), 0);
  const livreCA = slice.filter(o => o.status === 'livre').reduce((s, o) => s + (o.price || 0), 0);

  const counts = {
    total:     slice.length,
    nouveau:   slice.filter(o => o.status === 'nouveau').length,
    confirme:  slice.filter(o => o.status === 'confirme').length,
    livre:     slice.filter(o => o.status === 'livre').length,
    refuse:    slice.filter(o => o.status === 'refuse').length,
    annule:    slice.filter(o => o.status === 'annule').length,
    reporter:  slice.filter(o => o.status === 'reporter').length,
    en_suivi:  slice.filter(o => o.status === 'en_suivi').length,
    att_ram:   slice.filter(o => o.status === 'att_ramassage').length,
  };

  const retourCA = slice.filter(o => ['refuse','annule','retour','pret_retour'].includes(o.status)).reduce((s, o) => s + (o.price || 0), 0);
  const tauxRetour = counts.total > 0 ? Math.round(((counts.refuse + counts.annule) / counts.total) * 100) : 0;
  const taux = counts.total > 0 ? Math.round((counts.livre / counts.total) * 100) : 0;

  /* ── period summary cards data ── */
  const now = new Date();
  const weekStart = startOf(now, 'week');
  const MONTH_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  function fmtDate(d) { return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`; }

  const periodSummaries = useMemo(() => [
    { label: "Aujourd'hui",   dateHint: fmtDate(now),       orders: filterByPeriod(orders, 'today'),     bgClass: 'bg-gradient-to-br from-blue-500 to-blue-600' },
    { label: 'Hier',          dateHint: fmtDate(new Date(now.getTime()-86400000)), orders: filterByPeriod(orders, 'yesterday'), bgClass: 'bg-gradient-to-br from-slate-500 to-slate-600' },
    { label: 'Cette semaine', dateHint: `depuis ${fmtDate(weekStart)}`, orders: filterByPeriod(orders, 'week'), bgClass: 'bg-gradient-to-br from-cyan-500 to-sky-600' },
    { label: 'Ce mois',       dateHint: MONTH_FR[now.getMonth()], orders: filterByPeriod(orders, 'month'), bgClass: 'bg-gradient-to-br from-teal-500 to-emerald-600' },
    { label: 'Total',         dateHint: null,                orders,       bgClass: 'bg-gradient-to-br from-orange-500 to-orange-600' },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [orders]);

  const kpis = [
    { icon: ShoppingCart, label: 'Total commandes',  value: counts.total,   iconBg: 'bg-blue-500',    sub: `${counts.nouveau} nouvelles` },
    { icon: CheckCircle,  label: 'Confirmées',        value: counts.confirme, iconBg: 'bg-green-500',  sub: `${counts.en_suivi} en suivi` },
    { icon: Truck,        label: 'Livrées',           value: counts.livre,   iconBg: 'bg-emerald-500', sub: `Taux: ${taux}%` },
    { icon: XCircle,      label: 'Refusées / Annulées', value: counts.refuse + counts.annule, iconBg: 'bg-red-500', sub: `${counts.refuse} refusées, ${counts.annule} annulées` },
    { icon: RotateCcw,    label: 'Reportées',         value: counts.reporter, iconBg: 'bg-orange-500', sub: `${counts.att_ram} att. ramassage` },
    { icon: DollarSign,   label: 'Chiffre d\'affaires', value: `${ca.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} DH`, iconBg: 'bg-purple-500', sub: `Livré: ${livreCA.toLocaleString('fr-MA', {minimumFractionDigits:2})} DH` },
  ];

  const statusRows = [
    { label: 'Nouveau (À confirmer)',    count: counts.nouveau,  amount: slice.filter(o=>o.status==='nouveau').reduce((s,o)=>s+(o.price||0),0),  color: 'bg-blue-400' },
    { label: 'Confirmé',                 count: counts.confirme, amount: slice.filter(o=>o.status==='confirme').reduce((s,o)=>s+(o.price||0),0), color: 'bg-green-500' },
    { label: 'En attente ramassage',     count: counts.att_ram,  amount: undefined, color: 'bg-amber-400' },
    { label: 'En suivi',                 count: counts.en_suivi, amount: undefined, color: 'bg-purple-400' },
    { label: 'Livré',                    count: counts.livre,    amount: livreCA,   color: 'bg-emerald-500' },
    { label: 'Refusé',                   count: counts.refuse,   amount: undefined, color: 'bg-red-500' },
    { label: 'Annulé',                   count: counts.annule,   amount: undefined, color: 'bg-gray-400' },
    { label: 'Reporté',                  count: counts.reporter, amount: undefined, color: 'bg-orange-400' },
  ].filter(r => r.count > 0);

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Tableau de bord</h1>
          <p className="text-sm text-gray-500 mt-0.5">Vue d'ensemble de votre activité</p>
        </div>

      </div>

      {/* ── Period summary cards (Shopify-style) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {periodSummaries.map(p => (
          <PeriodCard key={p.label} {...p} />
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map(k => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Status breakdown */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Package size={16} className="text-blue-500" />
            Répartition par état
            <span className="ml-auto text-xs font-normal text-gray-400">Tous</span>
          </h2>
          {statusRows.length === 0 ? (
            <div className="py-8 text-center text-gray-300 text-sm">Aucune commande sur cette période</div>
          ) : (
            statusRows.map(r => <StatusRow key={r.label} {...r} />)
          )}
        </div>

        {/* CA summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col">
          <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-purple-500" />
            Chiffre d'affaires
          </h2>
          <div className="flex flex-col gap-3 flex-1">
            {[
              { label: 'Total confirmées', val: slice.filter(o=>['confirme','livre'].includes(o.status)).reduce((s,o)=>s+(o.price||0),0), color: 'text-green-700', bg: 'bg-green-50' },
              { label: 'Total livrées', val: livreCA, color: 'text-emerald-700', bg: 'bg-emerald-50' },
              { label: 'Retours / Refusés', val: retourCA, color: 'text-red-700', bg: 'bg-red-50' },
              { label: 'En attente', val: slice.filter(o=>['nouveau','reporter','en_suivi','att_ramassage'].includes(o.status)).reduce((s,o)=>s+(o.price||0),0), color: 'text-amber-700', bg: 'bg-amber-50' },
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
      </div>
    </div>
  );
}
