import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ShoppingCart, DollarSign, TrendingUp, TrendingDown, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

const STATUS_COLORS = {
  livre: '#22c55e',
  refuse: '#ef4444',
  annule: '#6b7280',
  nouveau: '#3b82f6',
  en_suivi: '#f59e0b',
  reporter: '#8b5cf6',
};

function parseDate(dateAdded) {
  if (!dateAdded) return null;
  const part = dateAdded.split(/[\s,à]+/)[0];
  const [d, m, y] = part.split('/');
  if (!d || !m || !y) return null;
  return new Date(+y, +m - 1, +d);
}

function KpiCard({ icon: Icon, value, label, color }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-800">{value}</div>
        <div className="text-sm text-gray-500">{label}</div>
      </div>
    </div>
  );
}

export default function AnalyticsPage({ orders = [] }) {
  const [period, setPeriod] = useState(30);

  const cutoff = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - period + 1);
    return d;
  }, [period]);

  const filtered = useMemo(
    () => orders.filter(o => { const d = parseDate(o.dateAdded); return d && d >= cutoff; }),
    [orders, cutoff]
  );

  const kpis = useMemo(() => {
    const total = filtered.length;
    const ca = filtered.reduce((s, o) => s + (parseFloat(o.price) || 0), 0);
    const livre = filtered.filter(o => o.status === 'livre').length;
    const refuse = filtered.filter(o => o.status === 'refuse').length;
    const annule = filtered.filter(o => o.status === 'annule').length;
    const denom = livre + refuse + annule;
    const tauxLiv = denom ? Math.round((livre / denom) * 100) : 0;
    const tauxRef = denom ? Math.round((refuse / denom) * 100) : 0;
    return { total, ca, tauxLiv, tauxRef };
  }, [filtered]);

  const dailyData = useMemo(() => {
    const map = {};
    for (let i = 0; i < period; i++) {
      const d = new Date(cutoff);
      d.setDate(d.getDate() + i);
      const key = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
      map[key] = 0;
    }
    filtered.forEach(o => {
      const d = parseDate(o.dateAdded);
      if (!d) return;
      const key = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
      if (key in map) map[key]++;
    });
    return Object.entries(map).map(([date, count]) => ({ date, count }));
  }, [filtered, period, cutoff]);

  const statusData = useMemo(() => {
    const keys = ['livre', 'refuse', 'annule', 'nouveau', 'en_suivi', 'reporter'];
    const map = {};
    keys.forEach(k => (map[k] = 0));
    filtered.forEach(o => { if (o.status in map) map[o.status]++; });
    return keys.map(k => ({ name: k, value: map[k] })).filter(x => x.value > 0);
  }, [filtered]);

  const cityData = useMemo(() => {
    const map = {};
    filtered.forEach(o => {
      const city = o.recipient?.city;
      if (city) map[city] = (map[city] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([city, count]) => ({ city, count }));
  }, [filtered]);

  const productData = useMemo(() => {
    const map = {};
    filtered.forEach(o => {
      const name = o.product?.name;
      if (name) map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }));
  }, [filtered]);

  const livreurData = useMemo(() => {
    const map = {};
    filtered.forEach(o => {
      const nom = o.recipient?.delivery?.nom;
      if (!nom) return;
      if (!map[nom]) map[nom] = { total: 0, livre: 0, refuse: 0 };
      map[nom].total++;
      if (o.status === 'livre') map[nom].livre++;
      if (o.status === 'refuse') map[nom].refuse++;
    });
    return Object.entries(map)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([nom, d]) => ({
        nom,
        total: d.total,
        livre: d.livre,
        refuse: d.refuse,
        taux: d.livre + d.refuse > 0 ? Math.round((d.livre / (d.livre + d.refuse)) * 100) : null,
      }));
  }, [filtered]);

  function exportExcel() {
    const STATUS_LABELS = {
      nouveau: 'À confirmer', en_suivi: 'En suivi', reporter: 'Reporté',
      confirme: 'Confirmé', livre: 'Livré', refuse: 'Refusé',
      annule: 'Annulé', att_ramassage: 'Att. ramassage', expedier: 'Expédié',
      recu_livreur: 'Reçu livreur', change: 'Échange', pas_rep_lv: 'Pas rép. LV',
    };

    const rows = filtered.map(o => ({
      'ID': o.id,
      'Nom': o.recipient?.name || '',
      'Téléphone': o.recipient?.phone || '',
      'Ville': o.recipient?.city || '',
      'Adresse': o.recipient?.address || '',
      'Livreur': o.recipient?.delivery?.nom || '',
      'Produit': o.product?.name || '',
      'Taille': o.product?.size || '',
      'Qté': o.product?.qty || 1,
      'Prix (MAD)': parseFloat(o.price) || 0,
      'Statut': STATUS_LABELS[o.status] || o.status,
      'Note': o.note || '',
      'Date ajout': o.dateAdded || '',
      'Date maj': o.dateUpdated || '',
    }));

    const summary = [
      { Indicateur: 'Total commandes', Valeur: kpis.total },
      { Indicateur: "Chiffre d'affaires (MAD)", Valeur: kpis.ca },
      { Indicateur: 'Taux de livraison', Valeur: `${kpis.tauxLiv}%` },
      { Indicateur: 'Taux de refus', Valeur: `${kpis.tauxRef}%` },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Commandes');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Résumé');

    const today = new Date().toLocaleDateString('fr-MA').replace(/\//g, '-');
    XLSX.writeFile(wb, `victoury-${period}j-${today}.xlsx`);
  }

  const periods = [7, 30, 90];
  const periodLabels = { 7: '7 jours', 30: '30 jours', 90: '90 jours' };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Analytiques</h1>
        <div className="flex gap-2 flex-wrap">
          {periods.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === p ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
          <button
            onClick={exportExcel}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors"
          >
            <Download size={15} />
            Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={ShoppingCart} value={kpis.total} label="Total commandes" color="bg-blue-500" />
        <KpiCard icon={DollarSign} value={`${kpis.ca.toLocaleString('fr-MA')} MAD`} label="Chiffre d'affaires" color="bg-emerald-500" />
        <KpiCard icon={TrendingUp} value={`${kpis.tauxLiv}%`} label="Taux de livraison" color="bg-green-500" />
        <KpiCard icon={TrendingDown} value={`${kpis.tauxRef}%`} label="Taux de refus" color="bg-red-500" />
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="text-base font-semibold text-gray-700 mb-4">Commandes par jour</h2>
        {dailyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dailyData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={Math.floor(period / 7)} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" name="Commandes" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-52 flex items-center justify-center text-gray-400 text-sm">Aucune donnée</div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-700 mb-4">Répartition des statuts</h2>
          {statusData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={180}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={STATUS_COLORS[entry.name] || '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1.5 text-sm">
                {statusData.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[s.name] || '#94a3b8' }} />
                    <span className="text-gray-600 capitalize">{s.name.replace('_', ' ')}</span>
                    <span className="font-medium text-gray-800 ml-auto pl-2">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-44 flex items-center justify-center text-gray-400 text-sm">Aucune donnée</div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-700 mb-4">Top villes</h2>
          {cityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={cityData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="city" tick={{ fontSize: 11 }} width={90} />
                <Tooltip />
                <Bar dataKey="count" name="Commandes" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center text-gray-400 text-sm">Aucune donnée</div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="text-base font-semibold text-gray-700 mb-4">Top produits</h2>
        {productData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={productData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
              <Tooltip />
              <Bar dataKey="count" name="Commandes" fill="#f59e0b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-44 flex items-center justify-center text-gray-400 text-sm">Aucune donnée</div>
        )}
      </div>

      {livreurData.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-700 mb-3">Performance livreurs</h2>
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Livreur</th>
                  <th className="px-4 py-3 text-center">Total</th>
                  <th className="px-4 py-3 text-center">Livré</th>
                  <th className="px-4 py-3 text-center">Refusé</th>
                  <th className="px-4 py-3 text-center">Taux livraison</th>
                </tr>
              </thead>
              <tbody>
                {livreurData.map((l, i) => (
                  <tr key={l.nom} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 font-medium text-gray-800">{l.nom}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{l.total}</td>
                    <td className="px-4 py-3 text-center text-green-600 font-medium">{l.livre}</td>
                    <td className="px-4 py-3 text-center text-red-500 font-medium">{l.refuse}</td>
                    <td className="px-4 py-3 text-center">
                      {l.taux !== null ? (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${l.taux >= 70 ? 'bg-green-100 text-green-700' : l.taux >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>
                          {l.taux}%
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
