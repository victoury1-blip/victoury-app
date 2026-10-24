import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, PackageX, CheckCircle2, AlertTriangle, Truck, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cloudGet, cloudSet } from '../lib/cloudSettings';
import { useStatuses } from '../contexts/StatusContext';
import { useToast } from './Toast';
import useSearchShortcut from '../hooks/useSearchShortcut';
import useDebounce from '../hooks/useDebounce';
import Pagination, { paginate } from './Pagination';
import PhoneChip, { normalizePhone } from './PhoneChip';
import { estColisRetour, estRecu, lireRecuIdsLocal } from '../lib/colisRetours';
import DeliveryStatusModal from './colis/DeliveryStatusModal';
import { COLIS_PIPELINE } from '../data/colisPipeline';
import { now } from '../lib/dateUtils';
import { chargerEtapeOzon, lireEtapesCache, ecrireEtapeCache } from '../lib/ozonEtape';

const estOzon = (o) => /ozon/i.test(o?.recipient?.delivery || '');
// Une étape lue il y a moins de 30 min n'est pas redemandée à Ozon.
const ETAPE_FRAICHE_MS = 30 * 60 * 1000;

/* Colis refusés / annulés / en retour, sortis de la Liste des Colis : on y
 * voit d'un coup ceux qui sont rentrés au local et ceux que la société de
 * livraison n'a pas encore rendus — c'est ceux-là qu'il faut lui réclamer. */

const FILTRES = [
  { id: 'non_recu', label: 'Non reçus' },
  { id: 'recu', label: 'Reçus' },
  { id: 'tous', label: 'Tous' },
];

/* Couleur du dernier statut Ozon — mêmes teintes que la Liste des Colis. */
/** Date d'ajout en millisecondes (« jj/mm/aaaa hh:mm:ss », ISO, ou created_at). */
function dateAjout(o) {
  const t = String(o?.dateAdded || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (t) return new Date(+t[3], +t[2] - 1, +t[1], +(t[4] || 0), +(t[5] || 0), +(t[6] || 0)).getTime();
  const d = Date.parse(o?.createdAt || o?.dateAdded || '');
  return Number.isFinite(d) ? d : 0;
}

function couleurOzon(statut) {
  const ls = (statut || '').toLowerCase();
  if (ls.includes('livr')) return 'bg-green-100 text-green-700';
  if (ls.includes('refus')) return 'bg-red-100 text-red-700';
  if (ls.includes('ramassage') || ls.includes('attente')) return 'bg-amber-100 text-amber-700';
  if (ls.includes('expédi') || ls.includes('recu') || ls.includes('reçu')) return 'bg-blue-100 text-blue-700';
  if (ls.includes('retour')) return 'bg-gray-200 text-gray-700';
  return 'bg-teal-100 text-teal-700';
}

function StatutBadge({ status }) {
  const { getLive } = useStatuses();
  const live = getLive(status);
  return (
    <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-semibold text-white"
      style={{ backgroundColor: live.color || '#6B7280' }}>
      {live.label || status}
    </span>
  );
}

export default function ColisRetoursPage({ orders, setOrders }) {
  const toast = useToast();
  const [recuIds, setRecuIds] = useState(lireRecuIdsLocal);
  const [filtre, setFiltre] = useState('non_recu');
  const [livreur, setLivreur] = useState('');
  const [search, setSearch] = useState('');
  const q = useDebounce(search, 200).toLowerCase().trim();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [deliveryOrder, setDeliveryOrder] = useState(null);
  const [etapes, setEtapes] = useState(lireEtapesCache);
  const enCoursRef = useRef(new Set());

  async function rafraichirEtape(order) {
    if (enCoursRef.current.has(order.id)) return;
    enCoursRef.current.add(order.id);
    try {
      // Introuvable chez Ozon : mémorisé quand même (vide), pour ne pas
      // laisser l'emplacement en chargement ni redemander en boucle.
      const e = (await chargerEtapeOzon(order)) || { statut: '', commentaire: '', date: '' };
      const saved = ecrireEtapeCache(order.id, e);
      setEtapes(prev => ({ ...prev, [order.id]: saved }));
    } finally {
      enCoursRef.current.delete(order.id);
    }
  }
  const searchRef = useRef(null);
  useSearchShortcut(searchRef);

  useEffect(() => {
    cloudGet('victoury_recu_ids').then(val => {
      if (!Array.isArray(val)) return;
      setRecuIds(prev => {
        const merged = new Set([...prev, ...val]);
        try { localStorage.setItem('victoury_recu_ids', JSON.stringify([...merged])); } catch { /* quota */ }
        return merged;
      });
    }).catch(() => { /* le local suffit */ });
  }, []);

  /* Même enregistrement que le badge Reçu / Non-reçu de la Liste des Colis :
     colonne orders.recu (source de vérité) + ancienne liste, pour que les deux
     pages disent toujours la même chose. */
  function toggleRecu(order) {
    const removing = estRecu(order, recuIds);
    const next = new Set(recuIds);
    if (removing) next.delete(order.id); else next.add(order.id);
    setRecuIds(next);
    try { localStorage.setItem('victoury_recu_ids', JSON.stringify([...next])); } catch { /* quota */ }
    cloudGet('victoury_recu_ids').then(cloud => {
      const merged = new Set([...(Array.isArray(cloud) ? cloud : []), ...next]);
      if (removing) merged.delete(order.id);
      cloudSet('victoury_recu_ids', [...merged]);
    }).catch(() => cloudSet('victoury_recu_ids', [...next]));
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, recu: !removing } : o));
    supabase.from('orders').update({ recu: !removing }).eq('id', order.id).then(({ error }) => {
      if (error) toast.error('Statut « reçu » non enregistré : ' + error.message);
    });
  }

  /* Changement de statut depuis la fenêtre Livraison : même règle que la Liste
     des Colis (note interne ajoutée, sortie du circuit si le statut n'en fait
     plus partie, code de suivi conservé). */
  function saveStatut(orderId, newStatus, note) {
    const ts = now();
    const quitte = !COLIS_PIPELINE.includes(newStatus) && newStatus !== 'reporter' && newStatus !== 'annule';
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      const u = { ...o, status: newStatus, dateUpdated: ts, note: (o.note || '') + (note ? `\nNote interne: ${note}` : '') };
      if (quitte) u.validated = false;
      return u;
    }));
  }

  const retours = useMemo(() => {
    const vus = new Set();
    return (orders || []).filter(o => {
      if (!o || vus.has(o.id)) return false;
      vus.add(o.id);
      return estColisRetour(o);
    })
      /* Ordre FIXE : la plus récemment ajoutée en haut, d'après sa date
         d'ajout (qui ne bouge jamais). L'ordre de la liste des commandes,
         lui, change à chaque mise à jour (suivi Ozon, synchro) : les lignes
         sautaient de place sous les yeux. Départage par identifiant. */
      .sort((a, b) => dateAjout(b) - dateAjout(a) || String(b.id).localeCompare(String(a.id)));
  }, [orders]);

  const livreurs = useMemo(
    () => [...new Set(retours.map(o => o.recipient?.delivery).filter(Boolean))].sort(),
    [retours]
  );

  const compte = useMemo(() => {
    const recus = retours.filter(o => estRecu(o, recuIds)).length;
    return { recu: recus, non_recu: retours.length - recus, tous: retours.length };
  }, [retours, recuIds]);

  const liste = useMemo(() => {
    const qDigits = q.replace(/\D/g, '');
    return retours.filter(o => {
      const r = estRecu(o, recuIds);
      if (filtre === 'recu' && !r) return false;
      if (filtre === 'non_recu' && r) return false;
      if (livreur && o.recipient?.delivery !== livreur) return false;
      if (!q) return true;
      return String(o.id).toLowerCase().includes(q)
        || (o.trackingNumber || '').toLowerCase().includes(q)
        || (o.recipient?.name || '').toLowerCase().includes(q)
        || (o.recipient?.city || '').toLowerCase().includes(q)
        || (qDigits && normalizePhone(o.recipient?.phone).includes(qDigits));
    });
  }, [retours, recuIds, filtre, livreur, q]);

  useEffect(() => { setPage(1); }, [filtre, livreur, q]);
  const pageItems = paginate(liste, page, perPage);

  /* Dernière étape Ozon des colis affichés, demandée en arrière-plan, trois à
     la fois : la page s'affiche tout de suite, les étapes arrivent ensuite. */
  const aCharger = pageItems
    .filter(o => estOzon(o) && !(etapes[o.id] && Date.now() - etapes[o.id].at < ETAPE_FRAICHE_MS))
    .map(o => o.id).join(',');
  useEffect(() => {
    if (!aCharger) return;
    const file = pageItems.filter(o => aCharger.split(',').includes(o.id));
    let annule = false;
    const ouvrier = async () => {
      while (!annule && file.length) await rafraichirEtape(file.shift());
    };
    Promise.all([ouvrier(), ouvrier(), ouvrier()]);
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aCharger]);

  return (
    <div className="p-4 sm:p-6 page-enter">
      <div className="flex items-center gap-2 mb-1">
        <span className="p-2 rounded-xl bg-orange-100"><PackageX size={18} className="text-orange-600" /></span>
        <h1 className="text-xl font-bold text-gray-800">Retours &amp; Annulés</h1>
      </div>
      <p className="text-xs text-gray-500 mb-5">
        Colis refusés, annulés, prêts pour le retour ou retournés — reçus au local ou encore chez la société de livraison (hors colis importés depuis Google Sheets).
      </p>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <button onClick={() => setFiltre('non_recu')}
          className={`text-left bg-white border rounded-xl p-3 shadow-sm transition ${filtre === 'non_recu' ? 'border-red-300 ring-2 ring-red-100' : 'border-gray-200'}`}>
          <p className="text-[11px] text-gray-400 uppercase font-semibold mb-1 flex items-center gap-1"><AlertTriangle size={12} /> Non reçus</p>
          <p className="text-lg font-bold text-red-600">{compte.non_recu}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">encore chez le transporteur</p>
        </button>
        <button onClick={() => setFiltre('recu')}
          className={`text-left bg-white border rounded-xl p-3 shadow-sm transition ${filtre === 'recu' ? 'border-green-300 ring-2 ring-green-100' : 'border-gray-200'}`}>
          <p className="text-[11px] text-gray-400 uppercase font-semibold mb-1 flex items-center gap-1"><CheckCircle2 size={12} /> Reçus</p>
          <p className="text-lg font-bold text-green-600">{compte.recu}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">rentrés au local</p>
        </button>
        <button onClick={() => setFiltre('tous')}
          className={`text-left bg-white border rounded-xl p-3 shadow-sm transition ${filtre === 'tous' ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200'}`}>
          <p className="text-[11px] text-gray-400 uppercase font-semibold mb-1">Total</p>
          <p className="text-lg font-bold text-gray-800">{compte.tous}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">retours &amp; annulés</p>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden">
          {FILTRES.map(f => (
            <button key={f.id} onClick={() => setFiltre(f.id)}
              className={`px-3 py-2 text-xs font-semibold transition ${filtre === f.id ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              {f.label} ({compte[f.id]})
            </button>
          ))}
        </div>
        {livreurs.length > 0 && (
          <select value={livreur} onChange={e => setLivreur(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200">
            <option value="">Tous les livreurs</option>
            {livreurs.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        )}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher... (/)"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[980px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Code', 'Client', 'Ville', 'Produit', 'Note interne', 'Livreur', 'Statut', 'Date', 'Suivi', 'Reçu'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400 text-sm">
                  {filtre === 'non_recu' ? 'Aucun colis en attente de retour 🎉' : 'Aucun colis'}
                </td></tr>
              )}
              {pageItems.map((o, idx) => {
                const recu = estRecu(o, recuIds);
                const prods = o.products?.length ? o.products : (o.product ? [o.product] : []);
                const note = (o.note || '').replace('Note interne: ', '').trim();
                return (
                  <tr key={o.id} className={idx % 2 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-gray-700 whitespace-nowrap">{o.trackingNumber || o.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-800">{o.recipient?.name || '—'}</div>
                      {o.recipient?.phone && <PhoneChip phone={o.recipient.phone} allOrders={orders} />}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{o.recipient?.city || '—'}</td>
                    <td className="px-4 py-3 text-gray-700 text-sm">
                      {prods.map((p, i) => (
                        <div key={i} className="whitespace-nowrap">
                          <span className="font-semibold">{p?.name}</span>
                          {p?.size && <span className="ml-1 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">{p.size}</span>}
                          {p?.qty > 1 && <span className="ml-1 text-xs text-gray-500">×{p.qty}</span>}
                        </div>
                      ))}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 w-[220px] min-w-[200px] max-w-[240px] whitespace-pre-wrap break-words">
                      {note || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{o.recipient?.delivery || '—'}</td>
                    <td className="px-4 py-3"><StatutBadge status={o.status} /></td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{o.dateUpdated || o.dateAdded}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        {/* Camion = suivi Ozon (historique, « Retourné », agence) ; livreur personnel = colis. */}
                        <button onClick={() => setDeliveryOrder(o)}
                          className="p-2 rounded-lg bg-amber-100 text-amber-600 hover:bg-amber-200 transition-colors"
                          title="Suivi livraison" aria-label="Suivi livraison">
                          {/ozon/i.test(o.recipient?.delivery || '') ? <Truck size={15} /> : <Package size={15} />}
                        </button>
                        {/* Dernière étape Ozon : statut + commentaire (agence, ramasseur, client…). */}
                        {estOzon(o) && (() => {
                          const e = etapes[o.id];
                          const statut = e?.statut || o.ozoneLastStatus;
                          if (!statut) return e ? null : <span className="h-4 w-20 rounded bg-gray-100 animate-pulse" />;
                          return (
                            <div className="max-w-[200px]">
                              <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap ${couleurOzon(statut)}`}>
                                {statut}
                              </span>
                              {e?.commentaire && <p className="text-[11px] font-semibold text-gray-700 mt-1 leading-snug">{e.commentaire}</p>}
                              {e?.date && <p className="text-[10px] text-gray-400 mt-0.5">{e.date}</p>}
                            </div>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleRecu(o)}
                        className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition whitespace-nowrap ${recu
                          ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                          : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'}`}>
                        {recu ? '✓ Reçu' : '✗ Non-reçu'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {deliveryOrder && (
        <DeliveryStatusModal
          key={deliveryOrder.id}
          order={deliveryOrder}
          onClose={() => { if (estOzon(deliveryOrder)) rafraichirEtape(deliveryOrder); setDeliveryOrder(null); }}
          onSave={(id, newStatus, newNote, newOzTn, ozoneLastStatus) => {
            if (newOzTn || ozoneLastStatus) {
              setOrders(prev => prev.map(o => o.id === id ? { ...o, ...(newOzTn ? { ozoneTracking: newOzTn } : {}), ...(ozoneLastStatus ? { ozoneLastStatus } : {}) } : o));
            }
            if (newNote !== '' || newStatus !== deliveryOrder?.status) saveStatut(id, newStatus, newNote);
            if (!newOzTn) setDeliveryOrder(null);
          }}
        />
      )}

      {liste.length > perPage && (
        <Pagination total={liste.length} page={page} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage} />
      )}
    </div>
  );
}
