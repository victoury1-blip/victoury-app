import React, { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

/* Clients déjà livrés au moins une fois — relancés sur WhatsApp d'un clic
   quand du nouveau stock arrive. Un zéro de plus en relation client coûte
   bien moins cher qu'une pub Meta pour aller chercher un nouveau zéro. Même
   principe que PaniersAbandonnesListe.jsx (lien wa.me, l'admin envoie
   lui-même). */

function numeroWhatsApp(tel) {
  const chiffres = (s) => (s || '').replace(/\D/g, '');
  let d = chiffres(tel);
  if (d.startsWith('212')) return d;
  if (d.startsWith('0')) return '212' + d.slice(1);
  if (d.length === 9) return '212' + d;
  return d;
}

function messageRelance(c) {
  return `السلام عليكم${c.nom ? ' ' + c.nom : ''} 👋 وصلات عندنا موديلات جداد عند Victoury، بغيت نوريهالك قبل ما تخلص 😊`;
}

export default function ClientsFideles() {
  const [clients, setClients] = useState(null);

  useEffect(() => {
    supabase.from('orders')
      .select('recipient, price, date_added')
      .like('id', 'VS-%')
      .eq('status', 'livre')
      .order('date_added', { ascending: false })
      .limit(1000)
      .then(({ data }) => {
        // Un client = un téléphone, la commande livrée la plus récente fait foi
        // pour le nom affiché ; le total cumule toutes ses commandes livrées.
        const parTel = new Map();
        for (const o of data || []) {
          const tel = (o.recipient?.phone || '').replace(/\D/g, '');
          if (!tel) continue;
          const existant = parTel.get(tel);
          if (existant) {
            existant.total += o.price || 0;
            existant.commandes += 1;
          } else {
            parTel.set(tel, {
              telephone: o.recipient.phone, nom: o.recipient?.name || '',
              ville: o.recipient?.city || '', total: o.price || 0, commandes: 1,
              derniereCommande: o.date_added,
            });
          }
        }
        setClients([...parTel.values()].sort((a, b) => b.total - a.total));
      })
      .catch(() => setClients([]));
  }, []);

  if (!clients) return <p className="text-sm text-gray-400">Chargement…</p>;

  return (
    <div>
      <h1 className="text-lg font-medium">Clients fidèles <span className="text-gray-400 font-normal">({clients.length})</span></h1>
      <p className="mt-1 text-sm text-gray-500">
        Tous les clients déjà livrés au moins une fois — relancez-les sur WhatsApp quand du nouveau stock arrive.
      </p>

      {clients.length === 0 ? (
        <p className="mt-8 text-sm text-gray-400">Aucun client livré pour l'instant.</p>
      ) : (
        <div className="mt-5 bg-white border border-gray-200 rounded-xl divide-y divide-gray-50">
          {clients.map(c => (
            <div key={c.telephone} className="flex items-center gap-4 p-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{c.nom || 'Client'} · {c.telephone}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {c.ville && `${c.ville} · `}{c.commandes} commande{c.commandes > 1 ? 's' : ''} livrée{c.commandes > 1 ? 's' : ''} · {c.total.toLocaleString('fr-FR')} DH au total
                </p>
              </div>
              <a href={`https://wa.me/${numeroWhatsApp(c.telephone)}?text=${encodeURIComponent(messageRelance(c))}`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 shrink-0">
                <MessageCircle size={14} /> WhatsApp
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
