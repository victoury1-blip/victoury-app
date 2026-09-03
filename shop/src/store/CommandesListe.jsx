import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fmtPrix } from '../lib/pricing';

const STATUT = {
  nouveau:     { label: 'En attente', cls: 'bg-amber-50 text-amber-700' },
  confirme:    { label: 'Confirmé',   cls: 'bg-blue-50 text-blue-700' },
  att_ramassage: { label: 'Validé',   cls: 'bg-blue-50 text-blue-700' },
  livre:       { label: 'Livré',      cls: 'bg-green-50 text-green-700' },
  annule:      { label: 'Annulé',     cls: 'bg-red-50 text-red-700' },
  refuse:      { label: 'Refusé',     cls: 'bg-red-50 text-red-700' },
  injoignable: { label: 'Injoignable', cls: 'bg-gray-100 text-gray-600' },
};
const statut = (s) => STATUT[s] || { label: s || '—', cls: 'bg-gray-100 text-gray-600' };

function Carte({ label, valeur, couleur }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-medium mt-1 ${couleur || ''}`}>{valeur}</p>
    </div>
  );
}

/* Lecture seule, volontairement : la commande entre directement dans le
 * pipeline de l'application (livreur, facture, historique, profit), qui a
 * déjà tout ce qu'il faut pour la faire avancer. La dupliquer ici — un
 * deuxième endroit qui écrit le statut — risquerait de contredire ce que
 * décide l'application, qui reste la seule source de vérité. */
export default function CommandesListe() {
  const [commandes, setCommandes] = useState(null);
  const [q, setQ] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('');

  // Une commande supprimée dans l'application (soft-delete : is_deleted)
  // reste visible ici, comme une archive — la retirer aussi de cette liste
  // effacerait la trace qu'elle est bien passée par le site.
  useEffect(() => {
    supabase.from('orders')
      .select('id, recipient, product, products, price, status, date_added, is_deleted')
      .like('id', 'VS-%')
      .order('date_added', { ascending: false }).limit(300)
      .then(({ data }) => setCommandes(data || []))
      .catch(() => setCommandes([]));
  }, []);

  const stats = useMemo(() => {
    // Une commande archivée (supprimée côté app) ne doit plus compter dans
    // le chiffre d'affaires ou les totaux — elle reste visible, mais elle
    // n'est plus une commande "active".
    const liste = (commandes || []).filter(c => !c.is_deleted);
    return {
      total: liste.length,
      enAttente: liste.filter(c => c.status === 'nouveau').length,
      livrees: liste.filter(c => c.status === 'livre').length,
      ca: liste.reduce((s, c) => s + (c.price || 0), 0),
    };
  }, [commandes]);

  const visibles = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (commandes || []).filter(c => {
      if (filtreStatut === 'archivee') return c.is_deleted;
      if (filtreStatut && filtreStatut !== 'archivee' && c.status !== filtreStatut) return false;
      if (!s) return true;
      const r = c.recipient || {};
      return [c.id, r.name, r.phone, r.city].some(v => String(v || '').toLowerCase().includes(s));
    });
  }, [commandes, q, filtreStatut]);

  if (!commandes) return <p className="text-sm text-gray-400">Chargement…</p>;

  return (
    <div>
      <h1 className="text-lg font-medium">Commandes</h1>
      <p className="text-xs text-gray-400 mt-0.5">Commandes passées sur le site</p>

      <div className="mt-5 grid sm:grid-cols-4 gap-4">
        <Carte label="Total commandes" valeur={stats.total} />
        <Carte label="En attente" valeur={stats.enAttente} couleur="text-amber-600" />
        <Carte label="Livrées" valeur={stats.livrees} couleur="text-green-600" />
        <Carte label="Chiffre d'affaires" valeur={fmtPrix(stats.ca)} />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher par nom, ID, téléphone, ville…"
          className="flex-1 min-w-[16rem] border border-gray-200 px-3 py-2.5 text-sm bg-white" />
        <select value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)} className="border border-gray-200 px-3 py-2.5 text-sm bg-white">
          <option value="">Tous les statuts</option>
          {Object.entries(STATUT).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
          <option value="archivee">Archivées</option>
        </select>
      </div>

      <div className="mt-5 bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="text-left px-4 py-3">Commande</th>
              <th className="text-left px-4 py-3">Client</th>
              <th className="text-left px-4 py-3">Articles</th>
              <th className="text-left px-4 py-3">Total</th>
              <th className="text-left px-4 py-3">Statut</th>
              <th className="text-left px-4 py-3">Source</th>
              <th className="text-left px-4 py-3">Localisation</th>
              <th className="text-left px-4 py-3">Date</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {visibles.map(c => {
              const r = c.recipient || {};
              const produits = c.products?.length ? c.products : (c.product ? [c.product] : []);
              const st = statut(c.status);
              return (
                <tr key={c.id} className={`hover:bg-gray-50 align-top ${c.is_deleted ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-mono text-xs text-blue-700">
                    #{c.id}
                    {c.is_deleted && <span className="ml-1.5 text-[10px] font-sans px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Archivée</span>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{r.name}</p>
                    <p className="text-xs text-gray-400">{r.city} · {r.phone}</p>
                  </td>
                  <td className="px-4 py-3">
                    {produits.map((p, i) => (
                      <p key={i} className="text-xs text-gray-600">{p.name} <span className="text-gray-400">· {p.size}{p.qty > 1 ? ` ×${p.qty}` : ''}</span></p>
                    ))}
                  </td>
                  <td className="px-4 py-3 font-medium">{fmtPrix(c.price)}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span></td>
                  <td className="px-4 py-3">
                    {r.source && <span className="text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-700">{r.source}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {r.geoVille || '—'}{r.geoPays ? `, ${r.geoPays}` : ''}
                    {r.ip && <div className="text-[10px] text-gray-300 font-mono">{r.ip}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{c.date_added}</td>
                  <td className="px-4 py-3">
                    <a href={`https://app.victoury-maroc.com/commandes/a-confirmer?q=${c.id}`} target="_blank" rel="noreferrer"
                      title="Ouvrir dans l'application" className="text-gray-400 hover:text-ink">
                      <ExternalLink size={15} />
                    </a>
                  </td>
                </tr>
              );
            })}
            {visibles.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">Aucune commande</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] text-gray-400">
        Pour confirmer, annuler, facturer ou suivre une livraison : ouvrez la commande dans l'application Victoury (icône ↗) — c'est elle qui pilote tout le reste.
      </p>
    </div>
  );
}
