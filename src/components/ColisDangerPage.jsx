import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, MessageCircle, Phone, CheckCircle2, Truck } from 'lucide-react';
import { cloudGet, cloudSet } from '../lib/cloudSettings';
import PhoneChip from './PhoneChip';
import DeliveryStatusModal from './colis/DeliveryStatusModal';
import { couleurProduit } from '../lib/couleurProduit';
import { COLIS_PIPELINE } from '../data/colisPipeline';
import { now } from '../lib/dateUtils';
import { risqueColis, dejaTraite, messageDanger, LIBELLE_TYPE } from '../lib/colisDanger';

/* Colis en danger : colis Ozon encore en route dont le dernier statut Ozon
 * (reçu en temps réel par le webhook, voir api/ozon-webhook.js) annonce un
 * échec probable. Un message WhatsApp ou un appel le jour même sauve une
 * bonne partie de ces livraisons. « Traité » retire le colis de la liste
 * jusqu'à ce qu'Ozon annonce un NOUVEAU statut à risque. */

const CLE = 'victoury_colis_danger_traites';
const NIVEAUX = {
  3: { label: 'Urgent', cls: 'bg-red-600 text-white' },
  2: { label: "Aujourd'hui", cls: 'bg-orange-500 text-white' },
  1: { label: 'À surveiller', cls: 'bg-amber-100 text-amber-800' },
};

const numeroWa = (tel) => {
  const d = String(tel || '').replace(/\D/g, '');
  if (d.startsWith('212')) return d;
  if (d.startsWith('0')) return '212' + d.slice(1);
  return d.length === 9 ? '212' + d : d;
};

export function lireTraitesLocal() {
  try { return JSON.parse(localStorage.getItem(CLE) || '{}'); } catch { return {}; }
}

export default function ColisDangerPage({ orders, setOrders }) {
  const [traites, setTraites] = useState(lireTraitesLocal);
  const [voirTraites, setVoirTraites] = useState(false);
  const [suivi, setSuivi] = useState(null);

  useEffect(() => {
    cloudGet(CLE).then(r => { if (r && typeof r === 'object') setTraites(prev => ({ ...prev, ...r })); }).catch(() => {});
  }, []);

  function basculerTraite(o) {
    const next = { ...traites };
    if (dejaTraite(o, traites)) delete next[o.id]; else next[o.id] = o.ozoneLastStatus;
    setTraites(next);
    try { localStorage.setItem(CLE, JSON.stringify(next)); } catch { /* quota */ }
    cloudSet(CLE, next);
  }

  const enDanger = useMemo(() => (orders || [])
    .map(o => ({ o, r: risqueColis(o) }))
    .filter(x => x.r)
    .sort((a, b) => b.r.niveau - a.r.niveau || String(b.o.dateUpdated || '').localeCompare(String(a.o.dateUpdated || ''))),
  [orders]);

  const aTraiter = enDanger.filter(x => !dejaTraite(x.o, traites));
  const liste = voirTraites ? enDanger : aTraiter;

  return (
    <div className="p-4 sm:p-6 page-enter">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="text-red-500" size={22} /> Colis en danger
            <span className="text-sm font-semibold bg-red-100 text-red-700 rounded-full px-2.5 py-0.5">{aTraiter.length}</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Colis en route pour lesquels Ozon signale un problème (injoignable, refus, numéro faux, adresse…).
            Contactez la cliente <b>aujourd'hui</b> : c'est souvent ce qui sauve la livraison.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={voirTraites} onChange={e => setVoirTraites(e.target.checked)} />
          Afficher aussi les traités ({enDanger.length - aTraiter.length})
        </label>
      </div>

      {liste.length === 0 ? (
        <div className="mt-10 text-center text-green-700 font-semibold">✅ Aucun colis en danger pour le moment.</div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {liste.map(({ o, r }) => {
            const traite = dejaTraite(o, traites);
            const prods = (o.products?.length ? o.products : [o.product]).filter(p => p?.name);
            const wa = numeroWa(o.recipient?.phone);
            const niv = NIVEAUX[r.niveau];
            return (
              <div key={o.id} className={`border rounded-xl p-4 shadow-sm bg-white ${traite ? 'opacity-60 border-gray-200' : r.niveau === 3 ? 'border-red-300' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-orange-600">{o.trackingNumber || o.id}</span>
                  <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${niv.cls}`}>{niv.label}</span>
                </div>
                <p className="mt-2 font-semibold text-gray-900">{o.recipient?.name || 'Client'}</p>
                <p className="text-sm text-gray-500">{o.recipient?.city}{o.recipient?.address ? ` — ${o.recipient.address}` : ''}</p>
                {o.recipient?.phone && <div className="mt-1"><PhoneChip phone={o.recipient.phone} allOrders={orders} /></div>}
                {prods.map((p, i) => (
                  <p key={i} className="text-sm mt-1">
                    <span className="font-semibold" style={{ color: couleurProduit(p.name) }}>{p.name}</span>
                    {p.size && <span className="text-gray-500"> - {p.size}</span>}
                  </p>
                ))}
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <span className="font-bold text-red-700 bg-red-50 rounded-md px-2 py-1">{o.ozoneLastStatus}</span>
                  <span className="text-xs text-gray-400">{LIBELLE_TYPE[r.type]}</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {wa && (
                    <a href={`https://wa.me/${wa}?text=${encodeURIComponent(messageDanger(o, r.type))}`} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold">
                      <MessageCircle size={15} /> WhatsApp
                    </a>
                  )}
                  {o.recipient?.phone && (
                    <a href={`tel:${o.recipient.phone}`}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold">
                      <Phone size={15} /> Appeler
                    </a>
                  )}
                  <button type="button" onClick={() => setSuivi(o)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-700 text-sm font-semibold"
                    title="Suivi Ozon">
                    <Truck size={15} />
                  </button>
                  <button type="button" onClick={() => basculerTraite(o)}
                    className={`ms-auto flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border ${traite ? 'border-gray-300 text-gray-500' : 'border-green-600 text-green-700 hover:bg-green-50'}`}>
                    <CheckCircle2 size={15} /> {traite ? 'Rouvrir' : 'Traité'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {suivi && (
        <DeliveryStatusModal
          key={suivi.id}
          order={suivi}
          onClose={() => setSuivi(null)}
          /* Même enregistrement que Retours & Annulés : code/statut Ozon mis à
             jour, et changement de statut avec note interne si demandé. */
          onSave={(id, newStatus, newNote, newOzTn, ozoneLastStatus) => {
            setOrders?.(prev => prev.map(o => {
              if (o.id !== id) return o;
              const u = { ...o, ...(newOzTn ? { ozoneTracking: newOzTn } : {}), ...(ozoneLastStatus ? { ozoneLastStatus } : {}) };
              if (newNote !== '' || newStatus !== o.status) {
                u.status = newStatus;
                u.dateUpdated = now();
                u.note = (o.note || '') + (newNote ? `\nNote interne: ${newNote}` : '');
                if (!COLIS_PIPELINE.includes(newStatus) && newStatus !== 'reporter' && newStatus !== 'annule') u.validated = false;
              }
              return u;
            }));
            if (!newOzTn) setSuivi(null);
          }}
        />
      )}
    </div>
  );
}
