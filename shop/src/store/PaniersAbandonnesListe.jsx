import React, { useEffect, useState } from 'react';
import { MessageCircle, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fmtPrix } from '../lib/pricing';
import { chargerPaniersActifs } from '../lib/paniersAbandonnes';

/* Un client qui a tapé son téléphone à la caisse (Commander.jsx, onBlur) mais
   n'a jamais validé — capturé côté client dans shop_paniers_abandonnes, à
   relancer ici sur WhatsApp. Écriture gratuite (lien wa.me, pas d'API
   payante) : on ouvre juste le chat avec un message prêt, l'admin l'envoie
   lui-même d'un clic. */

function numeroWhatsApp(tel) {
  const chiffres = (s) => (s || '').replace(/\D/g, '');
  let d = chiffres(tel);
  if (d.startsWith('212')) return d;
  if (d.startsWith('0')) return '212' + d.slice(1);
  if (d.length === 9) return '212' + d;
  return d;
}

function messageRelance(p) {
  const premier = p.lignes?.[0]?.name;
  const article = premier ? `"${premier}"${p.lignes.length > 1 ? ` (+${p.lignes.length - 1})` : ''}` : 'votre article';
  return `Bonjour${p.nom ? ' ' + p.nom : ''} 👋 vous avez laissé ${article} dans votre panier chez Victoury. Toujours intéressé(e) ? Je peux vous aider à finaliser votre commande 🙂`;
}

export default function PaniersAbandonnesListe() {
  const [visibles, setVisibles] = useState(null);

  useEffect(() => { chargerPaniersActifs().then(setVisibles).catch(() => setVisibles([])); }, []);

  async function supprimer(id) {
    setVisibles(list => list.filter(p => p.id !== id));
    await supabase.from('shop_paniers_abandonnes').delete().eq('id', id);
  }

  if (!visibles) return <p className="text-sm text-gray-400">Chargement…</p>;

  return (
    <div>
      <h1 className="text-lg font-medium">Paniers abandonnés <span className="text-gray-400 font-normal">({visibles.length})</span></h1>
      <p className="mt-1 text-sm text-gray-500">
        Un client a saisi son téléphone à la caisse sans finaliser sa commande — relancez-le sur WhatsApp d'un clic.
        Déjà commandé depuis : masqué automatiquement.
      </p>

      {visibles.length === 0 ? (
        <p className="mt-8 text-sm text-gray-400">Aucun panier abandonné pour l'instant.</p>
      ) : (
        <div className="mt-5 bg-white border border-gray-200 rounded-xl divide-y divide-gray-50">
          {visibles.map(p => (
            <div key={p.id} className="flex items-center gap-4 p-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{p.nom || 'Client'} · {p.telephone}</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {(p.lignes || []).map(l => `${l.name}${l.size ? ` (${l.size})` : ''} ×${l.qty}`).join(', ')}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {fmtPrix(p.total)} · {new Date(p.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <a href={`https://wa.me/${numeroWhatsApp(p.telephone)}?text=${encodeURIComponent(messageRelance(p))}`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 shrink-0">
                <MessageCircle size={14} /> WhatsApp
              </a>
              <button onClick={() => supprimer(p.id)} title="Retirer de la liste"
                className="p-2 text-gray-300 hover:text-red-500 shrink-0"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
