import React, { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Send, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { listerProduits } from '../lib/admin';
import { numeroWhatsApp } from '../lib/commande';
import { paliersEffectifs } from '../lib/remises';
import { prixLot, fmtMontant } from '../lib/pricing';
import { reservationEnAttente, dateReservation, dateDispo, messageReservation } from '../lib/precommande';

/* Commandes réservées (taille en rupture, arrivage attendu) — tenues hors de
   « À Confirmer » dans l'application tant qu'elles sont ici. Quand la
   marchandise arrive, « Envoyer à confirmer » les y fait passer d'un clic.
   Le bouton WhatsApp prévient la cliente que la commande est bien reçue
   (même principe que ClientsFideles.jsx : lien wa.me, l'admin envoie). */

/** « جوج ب 499 درهم بلاصة 580 درهم » pour le produit de la commande, si une
    remise par quantité s'applique à sa collection. */
function offrePour(o, produits, remises) {
  const nom = (o.products?.[0] || o.product)?.name;
  const p = produits.find(x => x.name === nom);
  if (!p) return '';
  const paliers = paliersEffectifs(remises, p.collection_id);
  if (!paliers.length) return '';
  const n = paliers[0].rang;
  const { brut, total } = prixLot(p.price, paliers, n);
  return `${n === 2 ? 'جوج' : `${n} قطع`} ب ${fmtMontant(total, 'ar')} بلاصة ${fmtMontant(brut, 'ar')}`;
}

export default function Reservations() {
  const [commandes, setCommandes] = useState(null);
  const [produits, setProduits] = useState([]);
  const [remises, setRemises] = useState([]);
  const [choix, setChoix] = useState(new Set());
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState('');

  function charger() {
    supabase.from('orders')
      .select('id, recipient, product, products, price, note, status, is_deleted, date_added')
      .like('id', 'VS-%').eq('status', 'nouveau')
      .then(({ data, error }) => {
        if (error) throw error;
        setCommandes((data || []).filter(reservationEnAttente));
      })
      .catch(() => setCommandes([]));
  }

  useEffect(() => {
    charger();
    listerProduits().then(setProduits).catch(() => {});
    supabase.from('shop_settings').select('value').eq('key', 'remises').maybeSingle()
      .then(({ data }) => setRemises(Array.isArray(data?.value) ? data.value : []));
  }, []);

  // Par date d'arrivage, puis par ordre d'arrivée de la commande.
  const liste = useMemo(() => (commandes || []).slice().sort((a, b) =>
    String(dateReservation(a) || '').localeCompare(String(dateReservation(b) || ''))
    || String(a.id).localeCompare(String(b.id))), [commandes]);

  async function envoyerAConfirmer(ids) {
    if (!ids.length) return;
    if (!confirm(`Envoyer ${ids.length} commande${ids.length > 1 ? 's' : ''} dans « À Confirmer » de l'application ?`)) return;
    setEnvoi(true); setMessage('');
    let ok = 0;
    for (const id of ids) {
      const o = commandes.find(c => c.id === id);
      if (!o) continue;
      const reservation = { ...(o.recipient?.reservation || { date: dateReservation(o) }), envoyee: true, envoyeeLe: new Date().toISOString() };
      const { error } = await supabase.from('orders').update({ recipient: { ...o.recipient, reservation } }).eq('id', id);
      if (!error) ok++;
    }
    setEnvoi(false);
    setChoix(new Set());
    setMessage(ok === ids.length
      ? `✓ ${ok} commande${ok > 1 ? 's' : ''} envoyée${ok > 1 ? 's' : ''} dans « À Confirmer ».`
      : `${ok} / ${ids.length} envoyées — réessayez pour les autres.`);
    charger();
  }

  const basculer = (id) => setChoix(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  if (!commandes) return <p className="text-sm text-gray-400">Chargement…</p>;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium">Réservations <span className="text-gray-400 font-normal">({liste.length})</span></h1>
          <p className="mt-1 text-sm text-gray-500 max-w-2xl">
            Commandes passées sur une taille en rupture. Elles n'apparaissent pas dans « À Confirmer » de l'application
            tant que vous ne les y envoyez pas — faites-le quand la marchandise est arrivée.
          </p>
        </div>
        {liste.length > 0 && (
          <div className="flex gap-2">
            {choix.size > 0 && (
              <button onClick={() => envoyerAConfirmer([...choix])} disabled={envoi}
                className="flex items-center gap-1.5 px-3 py-2 bg-ink text-white text-xs rounded-lg disabled:opacity-50">
                <Send size={14} /> Envoyer la sélection ({choix.size})
              </button>
            )}
            <button onClick={() => envoyerAConfirmer(liste.map(o => o.id))} disabled={envoi}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-xs rounded-lg hover:bg-gray-50 disabled:opacity-50">
              <Send size={14} /> Tout envoyer à confirmer
            </button>
          </div>
        )}
      </div>

      {message && <p className="mt-3 text-sm text-green-700">{message}</p>}

      {liste.length === 0 ? (
        <p className="mt-8 text-sm text-gray-400">Aucune réservation en attente.</p>
      ) : (
        <div className="mt-5 bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {liste.map(o => {
            const date = dateReservation(o);
            const prods = (o.products?.length ? o.products : [o.product]).filter(p => p?.name);
            const wa = numeroWhatsApp(o.recipient?.phone);
            return (
              <div key={o.id} className="flex flex-wrap items-center gap-4 p-4">
                <input type="checkbox" checked={choix.has(o.id)} onChange={() => basculer(o.id)} className="w-4 h-4" />
                <div className="flex-1 min-w-[220px]">
                  <p className="text-sm font-medium text-gray-800">
                    {o.recipient?.name || 'Client'} · {o.recipient?.phone}
                    {o.recipient?.city && <span className="text-gray-500 font-normal"> · {o.recipient.city}</span>}
                  </p>
                  {prods.map((p, i) => (
                    <p key={i} className="text-xs text-gray-600 mt-0.5">
                      {p.name}{p.size && <b className="ml-1 text-blue-700">{p.size}</b>}{(p.qty || 1) > 1 && ` ×${p.qty}`}
                    </p>
                  ))}
                  <p className="text-xs text-gray-400 mt-0.5">{o.id} · {o.date_added} · {Number(o.price || 0).toLocaleString('fr-FR')} DH</p>
                </div>
                {date && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-2.5 py-1">
                    <Clock size={12} /> Arrivage {dateDispo(date)}
                  </span>
                )}
                <div className="flex gap-2 shrink-0">
                  {wa && (
                    <a href={`https://wa.me/${wa}?text=${encodeURIComponent(messageReservation(o, offrePour(o, produits, remises)))}`}
                      target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700">
                      <MessageCircle size={14} /> WhatsApp
                    </a>
                  )}
                  <button onClick={() => envoyerAConfirmer([o.id])} disabled={envoi}
                    className="flex items-center gap-1.5 px-3 py-2 bg-ink text-white text-xs rounded-lg disabled:opacity-50">
                    <Send size={14} /> Envoyer à confirmer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
