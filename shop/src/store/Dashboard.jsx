import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Package, Layers, AlertTriangle, Archive, Users, ShoppingCart, ShoppingBag, Wallet, Percent, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

const PERIODES = [
  { cle: 'auj', label: 'Auj.', jours: 0 },
  { cle: 'hier', label: 'Hier', jours: 1 },
  { cle: '7', label: '7j', jours: 7 },
  { cle: '30', label: '30j', jours: 30 },
  { cle: '90', label: '90j', jours: 90 },
  { cle: '365', label: '1an', jours: 365 },
];

/** Même format que l'horodatage écrit par la boutique (JJ/MM/AAAA HH:MM:SS,
 *  voir src/lib/commande.js) — pas de colonne dédiée pour filtrer en base. */
function parseDateAdded(s) {
  const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1]);
}

/** Jour LOCAL 'AAAA-MM-JJ' (toISOString passait en UTC : minuit au Maroc
    devenait la veille à 23 h, et tous les jours glissaient d'un cran). */
/** Date ET heure de date_added (JJ/MM/AAAA HH:MM:SS), pour comparer à l'instant précis du début du suivi. */
function parseDateHeure(s) {
  const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
}

/** Horodatage Supabase → Date. Sans fuseau dans la chaîne, c'est de l'UTC
    (sinon le navigateur le lirait en heure locale et décalerait d'1 h ou plus). */
function lireHorodatage(t) {
  if (!t) return null;
  const s = String(t).replace(' ', 'T');
  const d = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s}Z`);
  return isNaN(d) ? null : d;
}
const heureMaroc = (d) => `${d.toLocaleDateString('fr-MA', { timeZone: 'Africa/Casablanca' })} ${d.toLocaleTimeString('fr-MA', { timeZone: 'Africa/Casablanca', hour: '2-digit', minute: '2-digit' })}`;

function isoJour(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function plageDePeriode(cle, custom) {
  const auj = new Date(); auj.setHours(0, 0, 0, 0);
  if (cle === 'custom') {
    const start = custom.start ? new Date(custom.start) : auj;
    const end = custom.end ? new Date(custom.end) : auj;
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (cle === 'hier') {
    const d = new Date(auj); d.setDate(d.getDate() - 1);
    const fin = new Date(d); fin.setHours(23, 59, 59, 999);
    return { start: d, end: fin };
  }
  const spec = PERIODES.find(p => p.cle === cle) || PERIODES[3];
  // « Auj. » (0 jour) commence aujourd'hui — la formule N-1 le mettait à demain.
  const start = new Date(auj); start.setDate(start.getDate() - Math.max(0, spec.jours - 1));
  const end = new Date(); end.setHours(23, 59, 59, 999);
  return { start, end };
}

/* Pastille de couleur de chaque indicateur (fond clair + icône). */
const TEINTES = {
  bleu: 'bg-blue-50 text-blue-600', orange: 'bg-orange-50 text-orange-500', rose: 'bg-pink-50 text-pink-500',
  vert: 'bg-green-50 text-green-600', violet: 'bg-purple-50 text-purple-500', gris: 'bg-gray-50 text-gray-400',
};

/** 10 234 → « 10.2K », 983 500 → « 983.5K », 1 250 000 → « 1.25M » ; tel quel sous 10 000. */
function compact(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(2).replace(/\.?0+$/, '')}M`;
  if (Math.abs(v) >= 1e4) return `${(v / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return v.toLocaleString('fr-MA');
}

const MOIS_COURTS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const jourCourt = (iso) => `${Number(iso.slice(8, 10))} ${MOIS_COURTS[Number(iso.slice(5, 7)) - 1] || ''}`;

/* Couleur de la courbe et de l'onglet actif, selon la série affichée. */
const SERIES = {
  revenu: { label: 'Revenue', titre: "Chiffre d'affaires", trait: '#22c55e', onglet: 'bg-green-50 text-green-700' },
  commandes: { label: 'Commandes', titre: 'Commandes', trait: '#f97316', onglet: 'bg-orange-50 text-orange-600' },
  sessions: { label: 'Sessions', titre: 'Sessions', trait: '#3b82f6', onglet: 'bg-blue-50 text-blue-600' },
};

function Carte({ icon: Icon, label, valeur, sous, teinte = 'gris' }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-gray-600">{label}</p>
        {Icon && <span className={`shrink-0 w-9 h-9 rounded-lg grid place-items-center ${TEINTES[teinte] || TEINTES.gris}`}><Icon size={17} /></span>}
      </div>
      <p className="text-[26px] leading-tight font-semibold text-gray-900 mt-2 tabular-nums">{valeur}</p>
      {sous && <p className="text-xs text-gray-400 mt-1">{sous}</p>}
    </div>
  );
}

/** Liste classée avec barre proportionnelle (sources, produits). */
function Classement({ titre, lignes, total }) {
  const max = Math.max(1, ...lignes.map(l => l[1]));
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <p className="text-sm font-medium mb-3">{titre}</p>
      {lignes.length === 0 && <p className="text-xs text-gray-400">Pas encore de données.</p>}
      <div className="space-y-2.5">
        {lignes.map(([nom, n]) => (
          <div key={nom}>
            <div className="flex justify-between text-xs">
              <span className="text-gray-700 truncate pr-3">{nom}</span>
              <span className="text-gray-500 tabular-nums shrink-0">{n.toLocaleString('fr-MA')}{total ? ` · ${Math.round((n / total) * 100)}%` : ''}</span>
            </div>
            <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: `${(n / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stock, setStock] = useState(null);
  const [parCollection, setParCollection] = useState(null);
  const [periode, setPeriode] = useState('30');
  const [custom, setCustom] = useState({ start: '', end: '' });
  const [commandes, setCommandes] = useState(null);
  const [ga4, setGa4] = useState(null);
  const [visites, setVisites] = useState(null);
  const [chargement, setChargement] = useState(false);

  const { start, end } = useMemo(() => plageDePeriode(periode, custom), [periode, custom]);

  /* Inventaire : indépendant de la période choisie, c'est un état présent. */
  const chargerStock = useCallback(async () => {
    const [{ data: produits }, { data: tailles }] = await Promise.all([
      supabase.from('shop_products').select('id, status, collection_id, shop_collections(name)'),
      supabase.from('shop_product_sizes').select('product_id, stock'),
    ]);
    const stockParProduit = new Map();
    for (const t of tailles || []) {
      stockParProduit.set(t.product_id, (stockParProduit.get(t.product_id) || 0) + (t.stock || 0));
    }
    let actifs = 0, archives = 0, rupture = 0, stockTotal = 0;
    const collections = new Map();
    for (const p of produits || []) {
      const s = stockParProduit.get(p.id) || 0;
      stockTotal += s;
      if (p.status === 'Actif') { actifs++; if (s === 0) rupture++; }
      if (p.status === 'Archivé') archives++;
      const nom = p.shop_collections?.name || 'Sans collection';
      const c = collections.get(nom) || { nom, stock: 0, produits: 0 };
      c.stock += s; c.produits += 1;
      collections.set(nom, c);
    }
    setStock({ actifs, archives, rupture, stockTotal, total: (produits || []).length });
    setParCollection([...collections.values()].sort((a, b) => b.stock - a.stock));
  }, []);

  /* Commandes du site sur la période — mêmes règles que le reste de
     l'administration (préfixe VS-, non supprimées). */
  const chargerCommandes = useCallback(async () => {
    const { data } = await supabase.from('orders')
      .select('id, price, date_added, created_at, is_deleted')
      .like('id', 'VS-%');
    const dans = (data || []).filter(o => {
      if (o.is_deleted) return false;
      const d = parseDateAdded(o.date_added);
      return d && d >= start && d <= end;
    });
    setCommandes(dans);
  }, [start, end]);

  const chargerGa4 = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch('/api/ga4-stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ startDate: isoJour(start), endDate: isoJour(end) }),
      });
      const j = await r.json().catch(() => ({}));
      setGa4(r.ok ? j : { configured: false });
    } catch {
      setGa4({ configured: false });
    }
  }, [start, end]);

  /* Statistiques maison (table shop_visites, voir visites.sql) : null si la
     table n'a pas encore été créée — on retombe alors sur Google Analytics. */
  // Premier instant enregistré : avant, aucune visite n'était comptée.
  const [debutSuivi, setDebutSuivi] = useState(null);
  useEffect(() => {
    supabase.from('shop_visites').select('created_at').order('created_at', { ascending: true }).limit(1)
      .then(({ data }) => { const d = lireHorodatage(data?.[0]?.created_at); if (d) setDebutSuivi(d); }, () => {});
  }, []);

  const chargerVisites = useCallback(async () => {
    const fin = new Date(end); fin.setHours(0, 0, 0, 0); fin.setDate(fin.getDate() + 1);
    const { data, error } = await supabase.rpc('shop_stats_visites', { p_debut: start.toISOString(), p_fin: fin.toISOString() });
    setVisites(!error && data ? data : null);
  }, [start, end]);

  useEffect(() => { chargerStock(); }, [chargerStock]);

  const toutRecharger = useCallback(async () => {
    setChargement(true);
    await Promise.all([chargerCommandes(), chargerGa4(), chargerVisites()]);
    setChargement(false);
  }, [chargerCommandes, chargerGa4, chargerVisites]);

  useEffect(() => { toutRecharger(); }, [toutRecharger]);

  const ca = useMemo(() => (commandes || []).reduce((s, o) => s + (Number(o.price) || 0), 0), [commandes]);
  const nbCommandes = commandes?.length ?? 0;
  const sessions = visites ? visites.sessions : (ga4?.sessions ?? null);
  const visiteurs = visites ? visites.visiteurs : (ga4?.totalUsers ?? null);
  const paniers = visites ? visites.paniers : (ga4?.ajoutsPanier ?? null);
  /* Conversion : seulement les commandes arrivées depuis le début du suivi des
     visites — sinon 100 commandes de la semaine ÷ 2 visites du jour = 5000 %. */
  const suiviPartiel = !!(visites && debutSuivi && debutSuivi > start);
  const commandesSuivies = useMemo(() => {
    if (!commandes) return 0;
    if (!suiviPartiel) return commandes.length;
    return commandes.filter(o => { const d = lireHorodatage(o.created_at) || parseDateHeure(o.date_added); return d && d >= debutSuivi; }).length;
  }, [commandes, suiviPartiel, debutSuivi]);
  const tauxConversion = sessions ? (commandesSuivies / sessions) * 100 : null;

  /* Série journalière pour le graphique — un point par jour de la période,
     même les jours sans commande (sinon la courbe « saute » les trous). */
  const serie = useMemo(() => {
    if (!commandes) return [];
    const parJour = new Map();
    for (const v of visites?.par_jour || []) {
      parJour.set(v.jour, { date: v.jour, revenu: 0, commandes: 0, sessions: Number(v.sessions) || 0 });
    }
    for (const o of commandes) {
      const d = parseDateAdded(o.date_added);
      if (!d) continue;
      const cle = isoJour(d);
      const e = parJour.get(cle) || { date: cle, revenu: 0, commandes: 0, sessions: 0 };
      e.revenu += Number(o.price) || 0;
      e.commandes += 1;
      parJour.set(cle, e);
    }
    const jours = [];
    const cur = new Date(start);
    while (cur <= end) {
      const cle = isoJour(cur);
      jours.push(parJour.get(cle) || { date: cle, revenu: 0, commandes: 0, sessions: 0 });
      cur.setDate(cur.getDate() + 1);
    }
    return jours;
  }, [commandes, visites, start, end]);

  const [vueGraph, setVueGraph] = useState('revenu');

  return (
    <div>
      {/* Inventaire */}
      <div className="grid sm:grid-cols-4 gap-4">
        <Carte icon={Package} teinte="bleu" label="Produits actifs" valeur={stock ? stock.actifs : '…'} />
        <Carte icon={Layers} teinte="vert" label="Stock total" valeur={stock ? stock.stockTotal.toLocaleString('fr-MA') : '…'} />
        <Carte icon={AlertTriangle} teinte="orange" label="Rupture de stock" valeur={stock ? stock.rupture : '…'} />
        <Carte icon={Archive} teinte="gris" label="Archivés" valeur={stock ? stock.archives : '…'} />
      </div>

      {parCollection?.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Stock par collection</h2>
          <div className="grid sm:grid-cols-4 gap-4">
            {parCollection.map(c => (
              <div key={c.nom} className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                <p className="text-xs text-gray-500">{c.nom}</p>
                <p className="text-xl font-medium mt-1">{c.stock.toLocaleString('fr-MA')}</p>
                <p className="text-xs text-gray-400 mt-0.5">{c.produits} produit{c.produits > 1 ? 's' : ''}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance */}
      <div className="mt-8 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-medium">Tableau de bord</h1>
          <p className="text-xs text-gray-400 mt-0.5">Performances de la boutique</p>
        </div>
        <button onClick={toutRecharger} disabled={chargement}
          className="flex items-center gap-1.5 text-xs border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw size={13} className={chargement ? 'animate-spin' : ''} /> Actualiser
        </button>
      </div>

      <div className="mt-4 flex items-center flex-wrap gap-2">
        {PERIODES.map(p => (
          <button key={p.cle} onClick={() => setPeriode(p.cle)}
            className={`px-3 py-1.5 text-xs rounded-lg border ${periode === p.cle ? 'bg-ink text-white border-ink' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {p.label}
          </button>
        ))}
        <div className="flex items-center gap-1.5 ml-1">
          <input type="date" value={custom.start} onChange={e => { setCustom(c => ({ ...c, start: e.target.value })); setPeriode('custom'); }}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5" />
          <span className="text-gray-300 text-xs">→</span>
          <input type="date" value={custom.end} onChange={e => { setCustom(c => ({ ...c, end: e.target.value })); setPeriode('custom'); }}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5" />
        </div>
      </div>

      <div className="mt-5 grid sm:grid-cols-5 gap-4">
        <Carte icon={Users} teinte="bleu" label="Sessions" valeur={sessions != null ? compact(sessions) : '—'}
          sous={visiteurs != null ? `${visiteurs.toLocaleString('fr-MA')} visiteurs uniques` : (ga4 && !ga4.configured ? 'Statistiques non activées (visites.sql)' : undefined)} />
        <Carte icon={ShoppingBag} teinte="orange" label="Commandes" valeur={compact(nbCommandes)}
          sous={nbCommandes ? `${Math.round(ca / nbCommandes).toLocaleString('fr-MA')} DH moy.` : undefined} />
        <Carte icon={ShoppingCart} teinte="rose" label="Ajouter au panier" valeur={paniers != null ? compact(paniers) : '—'}
          sous={paniers ? `${((commandesSuivies / paniers) * 100).toFixed(1)}% convertis` : undefined} />
        <Carte icon={Wallet} teinte="vert" label="Chiffre d'affaires" valeur={`${compact(Math.round(ca))} DH`} sous={`${nbCommandes.toLocaleString('fr-MA')} commandes`} />
        <Carte icon={Percent} teinte="violet" label="Taux de conversion" valeur={tauxConversion != null ? `${tauxConversion.toFixed(2)}%` : '—'}
          sous={tauxConversion != null
            ? `${commandesSuivies} / ${sessions} sessions${suiviPartiel ? ` · depuis le ${heureMaroc(debutSuivi)}` : ''}`
            : undefined} />
      </div>

      <div className="mt-6 bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <p className="text-base font-semibold text-gray-900">{SERIES[vueGraph].titre} dans le temps</p>
            <p className="text-xs text-gray-400 mt-0.5">{jourCourt(isoJour(start))} — {jourCourt(isoJour(end))}</p>
          </div>
          <div className="flex gap-1">
            {['revenu', 'commandes', ...(visites ? ['sessions'] : [])].map(v => (
              <button key={v} onClick={() => setVueGraph(v)}
                className={`px-3 py-1.5 text-sm rounded-lg ${vueGraph === v ? `${SERIES[v].onglet} font-medium` : 'text-gray-500 hover:bg-gray-50'}`}>
                {SERIES[v].label}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={serie}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={jourCourt} minTickGap={40} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={compact} axisLine={false} tickLine={false} width={44} />
            <Tooltip formatter={v => [vueGraph === 'revenu' ? `${v.toLocaleString('fr-MA')} DH` : v.toLocaleString('fr-MA'), SERIES[vueGraph].label]} labelFormatter={jourCourt} />
            <Line type="monotone" dataKey={vueGraph} stroke={SERIES[vueGraph].trait} strokeWidth={2} dot={serie.length <= 2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {visites && (visites.par_source?.length > 0 || visites.produits?.length > 0) && (
        <div className="mt-6 grid md:grid-cols-2 gap-4">
          <Classement titre="Sources des visites" lignes={(visites.par_source || []).map(x => [x.source, Number(x.sessions) || 0])} total={sessions} />
          <Classement titre="Produits ajoutés au panier" lignes={(visites.produits || []).map(x => [x.produit, Number(x.ajouts) || 0])} />
        </div>
      )}

      <p className="mt-4 text-xs text-gray-400">
        Les commandes passées sur le site apparaissent directement dans l'application, onglet « À Confirmer ».
      </p>
    </div>
  );
}
