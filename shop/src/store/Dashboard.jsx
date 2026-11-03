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

function Carte({ icon: Icon, label, valeur, sous }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{label}</p>
        {Icon && <Icon size={16} className="text-gray-300" />}
      </div>
      <p className="text-2xl font-medium mt-1">{valeur}</p>
      {sous && <p className="text-xs text-gray-400 mt-0.5">{sous}</p>}
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
      .select('id, price, date_added, is_deleted')
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
  const tauxConversion = sessions ? (nbCommandes / sessions) * 100 : null;

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
        <Carte icon={Package} label="Produits actifs" valeur={stock ? stock.actifs : '…'} />
        <Carte icon={Layers} label="Stock total" valeur={stock ? stock.stockTotal.toLocaleString('fr-MA') : '…'} />
        <Carte icon={AlertTriangle} label="Rupture de stock" valeur={stock ? stock.rupture : '…'} />
        <Carte icon={Archive} label="Archivés" valeur={stock ? stock.archives : '…'} />
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
        <Carte icon={Users} label="Sessions" valeur={sessions != null ? sessions.toLocaleString('fr-MA') : '—'}
          sous={visiteurs != null ? `${visiteurs.toLocaleString('fr-MA')} visiteurs uniques` : (ga4 && !ga4.configured ? 'Statistiques non activées (visites.sql)' : undefined)} />
        <Carte icon={ShoppingBag} label="Commandes" valeur={nbCommandes.toLocaleString('fr-MA')}
          sous={nbCommandes ? `${Math.round(ca / nbCommandes).toLocaleString('fr-MA')} DH moy.` : undefined} />
        <Carte icon={ShoppingCart} label="Ajouter au panier" valeur={paniers != null ? paniers.toLocaleString('fr-MA') : '—'}
          sous={paniers ? `${((nbCommandes / paniers) * 100).toFixed(1)}% convertis` : undefined} />
        <Carte icon={Wallet} label="Chiffre d'affaires" valeur={`${ca.toLocaleString('fr-MA')} DH`} />
        <Carte icon={Percent} label="Taux de conversion" valeur={tauxConversion != null ? `${tauxConversion.toFixed(2)}%` : '—'}
          sous={tauxConversion != null ? `${nbCommandes} / ${sessions} sessions` : undefined} />
      </div>

      <div className="mt-6 bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium">{{ revenu: "Chiffre d'affaires", commandes: 'Commandes', sessions: 'Sessions' }[vueGraph]} dans le temps</p>
            <p className="text-xs text-gray-400 mt-0.5">{isoJour(start)} — {isoJour(end)}</p>
          </div>
          <div className="flex gap-1 bg-gray-50 rounded-lg p-1">
            {[['revenu', 'Revenu'], ['commandes', 'Commandes'], ...(visites ? [['sessions', 'Sessions']] : [])].map(([v, l]) => (
              <button key={v} onClick={() => setVueGraph(v)}
                className={`px-3 py-1 text-xs rounded-md ${vueGraph === v ? 'bg-white shadow-sm font-medium' : 'text-gray-500'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={serie}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={v => vueGraph === 'revenu' ? `${v.toLocaleString('fr-MA')} DH` : v} labelFormatter={l => l} />
            <Line type="monotone" dataKey={vueGraph} stroke="#22c55e" strokeWidth={2} dot={false} />
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
