import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Ban, X, Trash2 } from 'lucide-react';
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
  const [ipsBloquees, setIpsBloquees] = useState(new Set());
  const [telsBloques, setTelsBloques] = useState(new Set());

  useEffect(() => {
    supabase.from('shop_ip_bloquees').select('ip').then(({ data }) => {
      setIpsBloquees(new Set((data || []).map(r => r.ip)));
    }).catch(() => {});
    supabase.from('shop_telephones_bloquees').select('telephone').then(({ data }) => {
      setTelsBloques(new Set((data || []).map(r => r.telephone)));
    }).catch(() => {});
  }, []);

  // Le "builder" Supabase n'est thenable que via .then — lui chaîner un
  // .catch() direct (sans .then avant) plante avec "catch is not a
  // function" avant même que la requête parte : c'était le bug qui rendait
  // "Bloquer" inactif en silence sur les deux boutons.
  async function bloquerIpSansConfirmation(ip) {
    setIpsBloquees(s => new Set(s).add(ip));
    const { error } = await supabase.from('shop_ip_bloquees').insert({ ip });
    if (error) { alert(`Échec du blocage IP : ${error.message}`); setIpsBloquees(s => { const n = new Set(s); n.delete(ip); return n; }); }
  }

  async function bloquerTelephoneSansConfirmation(tel) {
    setTelsBloques(s => new Set(s).add(tel));
    const { error } = await supabase.from('shop_telephones_bloquees').insert({ telephone: tel });
    if (error) { alert(`Échec du blocage téléphone : ${error.message}`); setTelsBloques(s => { const n = new Set(s); n.delete(tel); return n; }); }
  }

  async function bloquerIp(ip) {
    if (!ip || ipsBloquees.has(ip)) return;
    if (!window.confirm(`Bloquer l'IP ${ip} ? Ses prochaines commandes seront ignorées en silence.`)) return;
    await bloquerIpSansConfirmation(ip);
  }

  async function bloquerTelephone(tel) {
    if (!tel || telsBloques.has(tel)) return;
    if (!window.confirm(`Bloquer le téléphone ${tel} ? Ses prochaines commandes seront ignorées en silence.`)) return;
    await bloquerTelephoneSansConfirmation(tel);
  }

  // Un client qui recommence bloque en général les deux d'un coup — un
  // clic au lieu de deux, avec une seule confirmation.
  async function bloquerToutCela(ip, tel) {
    const deja = (!ip || ipsBloquees.has(ip)) && (!tel || telsBloques.has(tel));
    if (deja) return;
    if (!window.confirm(`Bloquer l'IP${ip ? ` ${ip}` : ''} ET le téléphone${tel ? ` ${tel}` : ''} ? Ses prochaines commandes seront ignorées en silence.`)) return;
    if (ip && !ipsBloquees.has(ip)) await bloquerIpSansConfirmation(ip);
    if (tel && !telsBloques.has(tel)) await bloquerTelephoneSansConfirmation(tel);
  }

  // Débloquer : un blocage posé par erreur (mauvaise IP, faux numéro
  // retapé par un vrai client) doit pouvoir se défaire sans repasser par
  // le SQL Editor.
  async function debloquerIp(ip) {
    if (!window.confirm(`Débloquer l'IP ${ip} ?`)) return;
    setIpsBloquees(s => { const n = new Set(s); n.delete(ip); return n; });
    const { error } = await supabase.from('shop_ip_bloquees').delete().eq('ip', ip);
    if (error) { alert(`Échec du déblocage IP : ${error.message}`); setIpsBloquees(s => new Set(s).add(ip)); }
  }

  async function debloquerTelephone(tel) {
    if (!window.confirm(`Débloquer le téléphone ${tel} ?`)) return;
    setTelsBloques(s => { const n = new Set(s); n.delete(tel); return n; });
    const { error } = await supabase.from('shop_telephones_bloquees').delete().eq('telephone', tel);
    if (error) { alert(`Échec du déblocage téléphone : ${error.message}`); setTelsBloques(s => new Set(s).add(tel)); }
  }

  // Suppression douce (is_deleted), jamais un vrai DELETE — même règle que
  // le reste de l'application (voir CLAUDE.md) : la commande reste comme
  // archive, disponible pour l'historique, mais sort du chiffre d'affaires
  // et du compteur "En attente" (voir `stats` plus haut).
  async function supprimerCommande(id) {
    if (!window.confirm('Supprimer (archiver) cette commande ?')) return;
    setCommandes(list => list.map(c => c.id === id ? { ...c, is_deleted: true } : c));
    const { error } = await supabase.from('orders').update({ is_deleted: true }).eq('id', id);
    if (error) {
      alert(`Échec de la suppression : ${error.message}`);
      setCommandes(list => list.map(c => c.id === id ? { ...c, is_deleted: false } : c));
    }
  }

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
      // Une commande "supprimée" reste en base (archive), mais ne doit plus
      // apparaître dans la liste par défaut — sinon "Supprimer" ne change
      // rien à ce qu'on voit. Le filtre "Archivées" reste le seul endroit
      // pour la retrouver.
      if (c.is_deleted) return false;
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
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs text-gray-400">{r.city} · {r.phone}</p>
                      {r.phone && (
                        telsBloques.has(r.phone) ? (
                          <span className="flex items-center gap-1 text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                            Bloqué
                            <button onClick={() => debloquerTelephone(r.phone)} title="Débloquer ce téléphone" className="hover:text-red-900">
                              <X size={11} />
                            </button>
                          </span>
                        ) : (
                          <button onClick={() => bloquerTelephone(r.phone)} title="Bloquer ce téléphone"
                            className="flex items-center gap-1 text-[10px] font-medium text-red-500 border border-red-200 px-1.5 py-0.5 rounded hover:bg-red-50 shrink-0">
                            <Ban size={11} /> Bloquer
                          </button>
                        )
                      )}
                    </div>
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
                    {/* Estimation à partir de l'IP, pas l'adresse tapée par la
                        cliente — les réseaux mobiles au Maroc font souvent
                        sortir le trafic par des serveurs centralisés dans une
                        autre ville. "(approx.)" le rappelle plutôt que de
                        laisser croire à une localisation fiable. */}
                    {r.geoVille ? <>{r.geoVille}{r.geoPays ? `, ${r.geoPays}` : ''} <span className="text-gray-400">(approx.)</span></> : '—'}
                    {r.ip && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-400 font-mono">{r.ip}</span>
                        {ipsBloquees.has(r.ip) ? (
                          <span className="flex items-center gap-1 text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                            Bloquée
                            <button onClick={() => debloquerIp(r.ip)} title="Débloquer cette IP" className="hover:text-red-900">
                              <X size={11} />
                            </button>
                          </span>
                        ) : (
                          <button onClick={() => bloquerIp(r.ip)} title="Bloquer cette IP"
                            className="flex items-center gap-1 text-[10px] font-medium text-red-500 border border-red-200 px-1.5 py-0.5 rounded hover:bg-red-50 shrink-0">
                            <Ban size={11} /> Bloquer
                          </button>
                        )}
                      </div>
                    )}
                    {/* Un client qui recommence, on bloque en général IP +
                        téléphone d'un coup — plutôt que deux clics séparés. */}
                    {r.ip && r.phone && (!ipsBloquees.has(r.ip) || !telsBloques.has(r.phone)) && (
                      <button onClick={() => bloquerToutCela(r.ip, r.phone)} title="Bloquer l'IP et le téléphone ensemble"
                        className="mt-1 flex items-center gap-1 text-[10px] font-medium text-white bg-red-500 px-1.5 py-0.5 rounded hover:bg-red-600 shrink-0">
                        <Ban size={11} /> Bloquer les deux
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{c.date_added}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <a href={`https://app.victoury-maroc.com/commandes/a-confirmer?q=${c.id}`} target="_blank" rel="noreferrer"
                        title="Ouvrir dans l'application" className="text-gray-400 hover:text-ink">
                        <ExternalLink size={15} />
                      </a>
                      {!c.is_deleted && (
                        <button onClick={() => supprimerCommande(c.id)} title="Supprimer (archiver)"
                          className="text-gray-300 hover:text-red-500">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
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
