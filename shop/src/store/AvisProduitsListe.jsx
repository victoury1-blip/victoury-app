import React, { useEffect, useState } from 'react';
import { Star, BadgeCheck, Check, X, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

const ONGLETS = [
  { valeur: 'en_attente', label: 'À modérer' },
  { valeur: 'approuve', label: 'Publiés' },
  { valeur: 'rejete', label: 'Rejetés' },
];

/* Modération des avis EN ÉTOILES (formulaire client réel, voir
   AvisProduit.jsx et schema.sql/shop_reviews) — différent de "Avis clients"
   (captures d'écran choisies à la main). Un avis n'apparaît sur la fiche
   produit qu'une fois approuvé ici. */
export default function AvisProduitsListe() {
  const [onglet, setOnglet] = useState('en_attente');
  const [avis, setAvis] = useState(null);

  useEffect(() => {
    let vif = true;
    setAvis(null);
    supabase.from('shop_reviews')
      .select('id, rating, author_name, comment, verified_purchase, created_at, status, shop_products(name, slug)')
      .eq('status', onglet).order('created_at', { ascending: false })
      .then(({ data }) => { if (vif) setAvis(data || []); });
    return () => { vif = false; };
  }, [onglet]);

  async function changerStatut(id, status) {
    setAvis(prev => prev.filter(a => a.id !== id));
    await supabase.from('shop_reviews').update({ status }).eq('id', id);
  }

  async function supprimer(id) {
    if (!confirm('Supprimer définitivement cet avis ?')) return;
    setAvis(prev => prev.filter(a => a.id !== id));
    await supabase.from('shop_reviews').delete().eq('id', id);
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-medium">Avis produits</h1>
      <p className="text-sm text-gray-500 mt-1">
        Avis en étoiles déposés par les clientes sur une fiche produit. Un avis n'est visible sur le site
        qu'une fois publié ici — approuvez ou rejetez chaque avis "À modérer".
      </p>

      <div className="flex gap-2 mt-5 border-b border-gray-100">
        {ONGLETS.map(o => (
          <button key={o.valeur} onClick={() => setOnglet(o.valeur)}
            className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
              onglet === o.valeur ? 'border-gray-900 text-gray-900 font-medium' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}>
            {o.label}
          </button>
        ))}
      </div>

      {avis === null && <p className="mt-6 text-sm text-gray-400">Chargement…</p>}
      {avis?.length === 0 && <p className="mt-6 text-sm text-gray-400">Rien ici.</p>}

      <div className="mt-5 space-y-3">
        {avis?.map(a => (
          <div key={a.id} className="border border-gray-100 rounded-lg p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map(n => (
                      <Star key={n} size={14} className={n <= a.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
                    ))}
                  </div>
                  <span className="text-sm font-medium">{a.author_name}</span>
                  {a.verified_purchase && (
                    <span className="flex items-center gap-1 text-[11px] text-green-700 bg-green-50 border border-green-100 rounded-full px-2 py-0.5">
                      <BadgeCheck size={12} /> Achat vérifié
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {a.shop_products?.name || 'Produit supprimé'} · {new Date(a.created_at).toLocaleDateString('fr-FR')}
                </p>
                {a.comment && <p className="mt-2 text-sm text-gray-600">{a.comment}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {onglet !== 'approuve' && (
                  <button onClick={() => changerStatut(a.id, 'approuve')} title="Publier"
                    className="p-2 rounded-lg text-green-600 hover:bg-green-50"><Check size={16} /></button>
                )}
                {onglet !== 'rejete' && (
                  <button onClick={() => changerStatut(a.id, 'rejete')} title="Rejeter"
                    className="p-2 rounded-lg text-amber-600 hover:bg-amber-50"><X size={16} /></button>
                )}
                <button onClick={() => supprimer(a.id)} title="Supprimer définitivement"
                  className="p-2 rounded-lg text-red-500 hover:bg-red-50"><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
