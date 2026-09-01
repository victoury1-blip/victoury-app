import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

function Carte({ label, valeur }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-medium mt-1">{valeur}</p>
    </div>
  );
}

/* Les commandes du site s'écrivent directement dans la table de l'application,
   avec le préfixe VS- : ce tableau ne fait que les compter parmi elles. */
export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    (async () => {
      const [produits, commandes] = await Promise.all([
        supabase.from('shop_products').select('id', { count: 'exact', head: true }),
        supabase.from('orders').select('id, price', { count: 'exact' }).like('id', 'VS-%'),
      ]);
      const ca = (commandes.data || []).reduce((s, o) => s + (o.price || 0), 0);
      setStats({ produits: produits.count || 0, commandes: commandes.count || 0, ca });
    })().catch(() => setStats({ produits: 0, commandes: 0, ca: 0 }));
  }, []);

  return (
    <div>
      <h1 className="text-lg font-medium">Tableau de bord</h1>
      <div className="mt-5 grid sm:grid-cols-3 gap-4">
        <Carte label="Produits au catalogue" valeur={stats ? stats.produits : '…'} />
        <Carte label="Commandes du site" valeur={stats ? stats.commandes : '…'} />
        <Carte label="Chiffre d'affaires" valeur={stats ? `${stats.ca.toLocaleString('fr-MA')} DH` : '…'} />
      </div>
      <p className="mt-6 text-xs text-gray-400">
        Les commandes passées sur le site apparaissent directement dans l'application, onglet « À Confirmer ».
      </p>
    </div>
  );
}
