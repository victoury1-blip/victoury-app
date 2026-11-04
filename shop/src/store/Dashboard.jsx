import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { FUSEAU } from '../lib/fuseau';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Package, Layers, AlertTriangle, Archive, Users, ShoppingCart, ShoppingBag, Wallet, Percent, RefreshCw } from 'lucide-react';
import { BarChart, Bar } from 'recharts';
import { supabase } from '../lib/supabase';
import { periodePrecedente, variation, issuesCommandes, topProduits, commandesParHeure } from '../lib/statsBoutique';

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
const heureMaroc = (d) => `${d.toLocaleDateString('fr-MA', { timeZone: FUSEAU })} ${d.toLocaleTimeString('fr-MA', { timeZone: FUSEAU, hour: '2-digit', minute: '2-digit' })}`;

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

/** « ▲ +18% » vert / « ▼ -12% » rouge par rapport à la période précédente. */
function Evolution({ pct, inverse = false, libelle }) {
  if (pct == null) return null;
  const bon = inverse ? pct < 0 : pct > 0;
  const cls = pct === 0 ? 'text-gray-400 bg-gray-50' : bon ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50';
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold rounded-full px-1.5 py-0.5 ${cls}`} title={libelle}>
      {pct > 0 ? '▲' : pct < 0 ? '▼' : '='} {pct > 0 ? '+' : ''}{pct}%
    </span>
  );
}

function Carte({ icon: Icon, label, valeur, sous, teinte = 'gris', evolution, libelleEvolution }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-gray-600">{label}</p>
        {Icon && <span className={`shrink-0 w-9 h-9 rounded-lg grid place-items-center ${TEINTES[teinte] || TEINTES.gris}`}><Icon size={17} /></span>}
      </div>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <p className="text-[26px] leading-tight font-semibold text-gray-900 tabular-nums">{valeur}</p>
        <Evolution pct={evolution} libelle={libelleEvolution} />
      </div>
      {sous && <p className="text-xs text-gray-400 mt-1">{sous}</p>}
    </div>
  );
}

/** Liste classée avec barre proportionnelle (sources, produits). */
function Classement({ titre, lignes, total, couleur = 'bg-green-500', sous, children }) {
  const max = Math.max(1, ...lignes.map(l => l[1]));
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <p className="text-sm font-medium">{titre}</p>
      {sous && <p className="text-xs text-gray-400 mt-0.5">{sous}</p>}
      <div className="mb-3" />
      {lignes.length === 0 && <p className="text-xs text-gray-400">Pas encore de données.</p>}
      <div className="space-y-2.5">
        {lignes.map(([nom, n]) => (
          <div key={nom}>
            <div className="flex justify-between text-xs">
              <span className="text-gray-700 truncate pr-3">{nom}</span>
              <span className="text-gray-500 tabular-nums shrink-0">{n.toLocaleString('fr-MA')}{total ? ` · ${Math.round((n / total) * 100)}%` : ''}</span>
            </div>
            <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${couleur}`} style={{ width: `${(n / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      {children}
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
  const [visitesPrec, setVisitesPrec] = useState(null);
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
  /* Période d'avant de même durée. Si la période en cours n'est pas finie
     (« Auj. » à 10 h), on la coupe au même moment : aujourd'hui jusqu'à 10 h
     contre hier jusqu'à 10 h — pas contre toute la journée d'hier. */
  const prec = useMemo(() => {
    const p = periodePrecedente(start, end);
    const maintenant = new Date();
    const finComparable = maintenant < end ? new Date(p.start.getTime() + (maintenant - start)) : p.end;
    return { ...p, fin: finComparable };
  }, [start, end]);
  const [commandesPrec, setCommandesPrec] = useState(null);
  const chargerCommandes = useCallback(async () => {
    // Par pages de 1000 (limite Supabase), depuis le début de la période précédente.
    const depuis = new Date(prec.start); depuis.setDate(depuis.getDate() - 2);
    const toutes = [];
    for (let de = 0; de < 50000; de += 1000) {
      const { data, error } = await supabase.from('orders')
        .select('id, price, date_added, created_at, is_deleted, status, products, product')
        .like('id', 'VS-%')
        .gte('created_at', depuis.toISOString())
        .order('created_at', { ascending: true })
        .range(de, de + 999);
      if (error || !data?.length) break;
      toutes.push(...data);
      if (data.length < 1000) break;
    }
    const entre = (a, b) => toutes.filter(o => {
      if (o.is_deleted) return false;
      const d = parseDateAdded(o.date_added);
      return d && d >= a && d <= b;
    });
    setCommandes(entre(start, end));
    setCommandesPrec(entre(prec.start, prec.end).filter(o => {
      const d = lireHorodatage(o.created_at) || parseDateHeure(o.date_added);
      return !d || d <= prec.fin;
    }));
  }, [start, end, prec]);

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
    const [act, avant] = await Promise.all([
      supabase.rpc('shop_stats_visites', { p_debut: start.toISOString(), p_fin: fin.toISOString() }),
      supabase.rpc('shop_stats_visites', { p_debut: prec.start.toISOString(), p_fin: prec.fin.toISOString() }),
    ]);
    setVisites(!act.error && act.data ? act.data : null);
    setVisitesPrec(!avant.error && avant.data ? avant.data : null);
  }, [start, end, prec]);

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

  /* Comparaison avec la période précédente (même durée). Les visites ne
     comparent que si le suivi existait déjà pendant toute la période d'avant. */
  const caPrec = useMemo(() => (commandesPrec || []).reduce((s, o) => s + (Number(o.price) || 0), 0), [commandesPrec]);
  const visitesComparables = !!(visitesPrec && debutSuivi && debutSuivi <= prec.start);
  const evol = {
    sessions: visitesComparables ? variation(sessions, visitesPrec.sessions) : null,
    paniers: visitesComparables ? variation(paniers, visitesPrec.paniers) : null,
    commandes: commandesPrec ? variation(nbCommandes, commandesPrec.length) : null,
    ca: commandesPrec ? variation(ca, caPrec) : null,
    conversion: visitesComparables && visitesPrec.sessions && sessions
      ? variation(tauxConversion, ((commandesPrec?.length || 0) / visitesPrec.sessions) * 100) : null,
  };
  const libelleEvol = periode === 'auj' ? "par rapport à hier à la même heure" : `par rapport aux ${prec.jours} jours d'avant (au même moment)`;

  /* Entonnoir : visiteurs différents à chaque étape, puis commandes passées
     depuis le début du suivi (même période). */
  const etapes = useMemo(() => {
    const e = visites?.entonnoir;
    if (!e) return null;
    return [
      ['Visiteurs', Number(e.visite) || 0],
      ['Ont vu un produit', Number(e.produit) || 0],
      ['Ont cliqué « اشتري الآن »', Number(e.panier) || 0],
      ['Ont ouvert le formulaire de commande', Number(e.checkout) || 0],
      ['Ont commandé', commandesSuivies],
    ];
  }, [visites, commandesSuivies]);

  /* Dans le formulaire : jusqu'où vont les gens, et pourquoi l'envoi est refusé. */
  const formulaire = useMemo(() => {
    const lignes = visites?.formulaire;
    if (!lignes?.length) return null;
    const n = (d) => Number(lignes.find(x => x.detail === d)?.n) || 0;
    const champs = { nom: 'Nom', telephone: 'Téléphone', ville: 'Ville', adresse: 'Adresse' };
    const manques = {};
    for (const x of lignes) {
      if (!x.detail.startsWith('manque:')) continue;
      for (const c of x.detail.slice(7).split(',')) manques[c] = (manques[c] || 0) + (Number(x.n) || 0);
    }
    return {
      etapes: [
        ['Ont ouvert le formulaire', Number(visites.entonnoir?.checkout) || 0],
        ...Object.entries(champs).map(([k, l]) => [`Ont rempli « ${l} »`, n(`champ:${k}`)]),
        ['Ont cliqué « Envoyer »', n('envoi')],
        ['Commande enregistrée', commandesSuivies],
      ],
      manques: Object.entries(manques).sort((a, b) => b[1] - a[1]).map(([c, v]) => [champs[c] || c, v]),
      erreurs: lignes.filter(x => x.detail.startsWith('erreur:')).map(x => [x.detail.slice(7), Number(x.n) || 0]),
    };
  }, [visites, commandesSuivies]);

  const issues = useMemo(() => issuesCommandes(commandes), [commandes]);
  const classement = useMemo(() => topProduits(commandes), [commandes]);
  const heures = useMemo(() => commandesParHeure(commandes, o => lireHorodatage(o.created_at) || parseDateHeure(o.date_added)), [commandes]);
  const heurePic = heures.reduce((m, h) => (h.commandes > m.commandes ? h : m), { commandes: 0 });

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
        <Carte icon={Users} teinte="bleu" label="Sessions" valeur={sessions != null ? compact(sessions) : '—'} evolution={evol.sessions} libelleEvolution={libelleEvol}
          sous={visiteurs != null ? `${visiteurs.toLocaleString('fr-MA')} visiteurs uniques` : (ga4 && !ga4.configured ? 'Statistiques non activées (visites.sql)' : undefined)} />
        <Carte icon={ShoppingBag} teinte="orange" label="Commandes" valeur={compact(nbCommandes)} evolution={evol.commandes} libelleEvolution={libelleEvol}
          sous={nbCommandes ? `${Math.round(ca / nbCommandes).toLocaleString('fr-MA')} DH moy.` : undefined} />
        <Carte icon={ShoppingCart} teinte="rose" label="Clics « Acheter »" valeur={paniers != null ? compact(paniers) : '—'} evolution={evol.paniers} libelleEvolution={libelleEvol}
          sous={paniers ? `${((commandesSuivies / paniers) * 100).toFixed(1)}% convertis` : undefined} />
        <Carte icon={Wallet} teinte="vert" label="Chiffre d'affaires" valeur={`${compact(Math.round(ca))} DH`} evolution={evol.ca} libelleEvolution={libelleEvol} sous={`${nbCommandes.toLocaleString('fr-MA')} commandes`} />
        <Carte icon={Percent} teinte="violet" label="Taux de conversion" evolution={evol.conversion} libelleEvolution={libelleEvol} valeur={tauxConversion != null ? `${tauxConversion.toFixed(2)}%` : '—'}
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

      {/* Entonnoir : où les visiteurs s'arrêtent */}
      {etapes && etapes[0][1] > 0 && (
        <div className="mt-6 bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
          <p className="text-base font-semibold text-gray-900">Parcours des visiteurs</p>
          <p className="text-xs text-gray-400 mt-0.5">Combien de personnes différentes passent chaque étape — la plus grosse chute montre ce qu'il faut améliorer.</p>
          <div className="mt-4 space-y-3">
            {etapes.map(([nom, n], i) => {
              const base = etapes[0][1] || 1;
              const avant = i ? etapes[i - 1][1] : null;
              const garde = avant ? Math.round((n / avant) * 100) : null;
              return (
                <div key={nom}>
                  <div className="flex items-baseline justify-between text-sm gap-3">
                    <span className="text-gray-700">{i + 1}. {nom}</span>
                    <span className="tabular-nums text-gray-900 font-semibold shrink-0">
                      {n.toLocaleString('fr-MA')}
                      <span className="ml-2 text-xs font-normal text-gray-400">{Math.round((n / base) * 100)}%</span>
                    </span>
                  </div>
                  <div className="mt-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500" style={{ width: `${Math.max(1, (n / base) * 100)}%` }} />
                  </div>
                  {garde != null && (
                    <p className={`text-[11px] mt-0.5 ${garde < 30 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                      {garde}% de l'étape d'avant{garde < 30 ? ' — grosse perte ici' : ''}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          {!(visites.entonnoir.produit > 0) && (
            <p className="mt-3 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">Les étapes 2 et 4 se remplissent une fois la mise à jour de visites.sql exécutée dans Supabase.</p>
          )}
        </div>
      )}

      {/* Dans le formulaire de commande */}
      {visites && !formulaire && (
        <div className="mt-6 bg-white border border-dashed border-gray-300 rounded-2xl p-5 text-sm">
          <p className="font-semibold text-gray-900">Dans le formulaire de commande</p>
          <p className="text-xs text-gray-400 mt-1">Suivi actif — les chiffres apparaîtront dès que des visiteurs rempliront le formulaire de commande sur cette période.</p>
        </div>
      )}
      {formulaire && (
        <div className="mt-6 bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
          <p className="text-base font-semibold text-gray-900">Dans le formulaire de commande</p>
          <p className="text-xs text-gray-400 mt-0.5">Jusqu'où vont ceux qui ouvrent le formulaire, et ce qui bloque l'envoi.</p>
          <div className="mt-4 grid lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              {formulaire.etapes.map(([nom, v], i) => {
                const base = formulaire.etapes[0][1] || 1;
                const chute = i && formulaire.etapes[i - 1][1] - v;
                return (
                  <div key={nom} className="flex items-center gap-3 text-sm">
                    <span className="w-56 shrink-0 text-gray-700 truncate">{nom}</span>
                    <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, (v / base) * 100)}%` }} />
                    </div>
                    <span className="w-8 text-right tabular-nums font-semibold">{v}</span>
                    <span className={`w-16 text-[11px] ${chute > 0 ? 'text-red-600' : 'text-transparent'}`}>{chute > 0 ? `−${chute} ici` : '·'}</span>
                  </div>
                );
              })}
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">Envoi refusé : case vide ou invalide</p>
                {formulaire.manques.length
                  ? <div className="flex flex-wrap gap-1.5">{formulaire.manques.map(([c, v]) => (
                      <span key={c} className="text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded-full px-2.5 py-1"><b>{c}</b> · {v} personne{v > 1 ? 's' : ''}</span>
                    ))}</div>
                  : <p className="text-xs text-gray-400">Aucun pour le moment.</p>}
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">Envoi refusé par le site (message affiché)</p>
                {formulaire.erreurs.length
                  ? <ul className="space-y-1">{formulaire.erreurs.map(([m, v]) => (
                      <li key={m} className="text-xs bg-red-50 text-red-700 rounded-lg px-2.5 py-1.5">{m} <span className="opacity-70">· {v}</span></li>
                    ))}</ul>
                  : <p className="text-xs text-gray-400">Aucun pour le moment.</p>}
              </div>
              <p className="text-[11px] text-gray-400">Ceux qui ont rempli leur téléphone sans finir sont dans « Paniers abandonnés » — à rappeler.</p>
            </div>
          </div>
        </div>
      )}

      {/* Ce que deviennent les commandes du site */}
      {nbCommandes > 0 && (
        <div className="mt-6 bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
          <p className="text-base font-semibold text-gray-900">Que deviennent les commandes du site ?</p>
          <p className="text-xs text-gray-400 mt-0.5">Statut actuel dans l'application des {nbCommandes} commandes de la période.</p>
          <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ['attente', 'À confirmer', 'bg-indigo-50 text-indigo-700 border-indigo-100'],
              ['confirmees', 'Confirmées / en route', 'bg-sky-50 text-sky-700 border-sky-100'],
              ['livrees', 'Livrées', 'bg-green-50 text-green-700 border-green-100'],
              ['perdues', 'Annulées / refusées', 'bg-red-50 text-red-600 border-red-100'],
            ].map(([k, nom, cls]) => (
              <div key={k} className={`rounded-xl border p-4 ${cls}`}>
                <p className="text-xs font-medium opacity-80">{nom}</p>
                <p className="text-2xl font-semibold mt-1 tabular-nums">{issues[k]}</p>
                <p className="text-xs opacity-70">{Math.round((issues[k] / nbCommandes) * 100)}%{k === 'livrees' && issues.caLivre ? ` · ${compact(Math.round(issues.caLivre))} DH encaissés` : ''}</p>
              </div>
            ))}
          </div>
          {issues.livrees + issues.perdues > 0 && (
            <p className="mt-3 text-xs text-gray-500">
              Taux de livraison des commandes terminées : <b className="text-gray-800">{Math.round((issues.livrees / (issues.livrees + issues.perdues)) * 100)}%</b>
            </p>
          )}
        </div>
      )}

      {nbCommandes > 0 && (
        <div className="mt-6 grid lg:grid-cols-2 gap-4">
          <Classement titre="Produits les plus commandés" sous="Quantités commandées sur le site" couleur="bg-orange-400"
            lignes={classement.produits}>
            {classement.tailles.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">Tailles les plus demandées</p>
                <div className="flex flex-wrap gap-1.5">
                  {classement.tailles.map(([t, n]) => (
                    <span key={t} className="text-xs bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1">
                      <b>{t}</b> <span className="text-gray-500">{n}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Classement>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-sm font-medium">Heures des commandes</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {heurePic.commandes ? <>Le plus de commandes vers <b className="text-gray-700">{heurePic.heure}</b> — soyez disponibles pour confirmer à ce moment-là.</> : 'Heure du Maroc'}
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={heures} margin={{ top: 12, right: 0, left: -24, bottom: 0 }}>
                <XAxis dataKey="heure" tick={{ fontSize: 10, fill: '#9ca3af' }} interval={2} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={v => [v, 'Commandes']} cursor={{ fill: '#f9fafb' }} />
                <Bar dataKey="commandes" fill="#f97316" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {visites && (
        <div className="mt-6 grid md:grid-cols-3 gap-4">
          <Classement titre="Sources des visites" lignes={(visites.par_source || []).map(x => [x.source, Number(x.sessions) || 0])} total={sessions} />
          <Classement titre="Appareils" couleur="bg-blue-500"
            lignes={(visites.appareils || []).filter(x => x.appareil !== 'inconnu').map(x => [{ mobile: '📱 Téléphone', tablette: '📲 Tablette', ordinateur: '💻 Ordinateur' }[x.appareil] || x.appareil, Number(x.sessions) || 0])}
            total={(visites.appareils || []).filter(x => x.appareil !== 'inconnu').reduce((t, x) => t + (Number(x.sessions) || 0), 0)} />
          <Classement titre="Produits cliqués « Acheter »" couleur="bg-pink-500" lignes={(visites.produits || []).map(x => [x.produit, Number(x.ajouts) || 0])} />
        </div>
      )}

      <p className="mt-4 text-xs text-gray-400">
        Les commandes passées sur le site apparaissent directement dans l'application, onglet « À Confirmer ».
      </p>
    </div>
  );
}
