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

function isoJour(d) {
  return d.toISOString().slice(0, 10);
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
  const start = new Date(auj); start.setDate(start.getDate() - spec.jours + 1);
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

export default function Dashboard() {
  const [stock, setStock] = useState(null);
  const [parCollection, setParCollection] = useState(null);
  const [periode, setPeriode] = useState('30');
  const [custom, setCustom] = useState({ start: '', end: '' });
  const [commandes, setCommandes] = useState(null);
  const [ga4, setGa4] = useState(null);
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

  useEffect(() => { chargerStock(); }, [chargerStock]);

  const toutRecharger = useCallback(async () => {
    setChargement(true);
    await Promise.all([chargerCommandes(), chargerGa4()]);
    setChargement(false);
  }, [chargerCommandes, chargerGa4]);

  useEffect(() => { toutRecharger(); }, [toutRecharger]);

  const ca = useMemo(() => (commandes || []).reduce((s, o) => s + (Number(o.price) || 0), 0), [commandes]);
  const nbCommandes = commandes?.length ?? 0;
  const sessions = ga4?.sessions ?? null;
  const tauxConversion = sessions ? (nbCommandes / sessions) * 100 : null;

  /* Série journalière pour le graphique — un point par jour de la période,
     même les jours sans commande (sinon la courbe « saute » les trous). */
  const serie = useMemo(() => {
    if (!commandes) return [];
    const parJour = new Map();
    for (const o of commandes) {
      const d = parseDateAdded(o.date_added);
      if (!d) continue;
      const cle = isoJour(d);
      const e = parJour.get(cle) || { date: cle, revenu: 0, commandes: 0 };
      e.revenu += Number(o.price) || 0;
      e.commandes += 1;
      parJour.set(cle, e);
    }
    const jours = [];
    const cur = new Date(start);
    while (cur <= end) {
      const cle = isoJour(cur);
      jours.push(parJour.get(cle) || { date: cle, revenu: 0, commandes: 0 });
      cur.setDate(cur.getDate() + 1);
    }
    return jours;
  }, [commandes, start, end]);

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
          sous={ga4?.totalUsers != null ? `${ga4.totalUsers.toLocaleString('fr-MA')} visiteurs uniques` : (ga4 && !ga4.configured ? 'Google Analytics non configuré' : undefined)} />
        <Carte icon={ShoppingBag} label="Commandes" valeur={nbCommandes.toLocaleString('fr-MA')}
          sous={nbCommandes ? `${Math.round(ca / nbCommandes).toLocaleString('fr-MA')} DH moy.` : undefined} />
        <Carte icon={ShoppingCart} label="Ajouter au panier" valeur={ga4?.ajoutsPanier != null ? ga4.ajoutsPanier.toLocaleString('fr-MA') : '—'} />
        <Carte icon={Wallet} label="Chiffre d'affaires" valeur={`${ca.toLocaleString('fr-MA')} DH`} />
        <Carte icon={Percent} label="Taux de conversion" valeur={tauxConversion != null ? `${tauxConversion.toFixed(2)}%` : '—'}
          sous={tauxConversion != null ? `${nbCommandes} / ${sessions} sessions` : undefined} />
      </div>

      <div className="mt-6 bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium">{vueGraph === 'revenu' ? "Chiffre d'affaires" : 'Commandes'} dans le temps</p>
            <p className="text-xs text-gray-400 mt-0.5">{isoJour(start)} — {isoJour(end)}</p>
          </div>
          <div className="flex gap-1 bg-gray-50 rounded-lg p-1">
            {[['revenu', 'Revenu'], ['commandes', 'Commandes']].map(([v, l]) => (
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

      <p className="mt-4 text-xs text-gray-400">
        Les commandes passées sur le site apparaissent directement dans l'application, onglet « À Confirmer ».
      </p>
    </div>
  );
}
