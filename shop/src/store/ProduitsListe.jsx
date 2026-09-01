import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ImageOff } from 'lucide-react';
import { listerProduits, supprimerProduit } from '../lib/admin';
import { fmtPrix } from '../lib/pricing';

const BADGE = { Actif: 'bg-green-50 text-green-700', Archivé: 'bg-gray-100 text-gray-500', Brouillon: 'bg-amber-50 text-amber-700' };

export default function ProduitsListe() {
  const [produits, setProduits] = useState(null);
  const [q, setQ] = useState('');

  const recharger = () => listerProduits().then(setProduits).catch(() => setProduits([]));
  useEffect(() => { recharger(); }, []);

  async function retirer(p) {
    // Un produit vendu doit rester traçable : on archive plutôt que d'effacer.
    if (!confirm(`Supprimer « ${p.name} » ? Cette action est définitive.`)) return;
    await supprimerProduit(p.id);
    recharger();
  }

  if (!produits) return <p className="text-sm text-gray-400">Chargement…</p>;
  const visibles = produits.filter(p => p.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-lg font-medium">Produits <span className="text-gray-400 font-normal">({produits.length})</span></h1>
        <Link to="/store/produits/nouveau" className="flex items-center gap-2 bg-ink text-white px-4 py-2.5 text-xs tracking-wide uppercase">
          <Plus size={14} /> Ajouter un produit
        </Link>
      </div>

      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un produit…"
        className="mt-4 w-full max-w-sm border border-gray-200 px-3 py-2.5 text-sm bg-white" />

      <div className="mt-5 bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="text-left px-4 py-3">Produit</th>
              <th className="text-left px-4 py-3">Statut</th>
              <th className="text-left px-4 py-3">Prix</th>
              <th className="text-left px-4 py-3">Stock</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {visibles.map(p => {
              const stock = (p.sizes || []).reduce((s, x) => s + (x.stock || 0), 0);
              return (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <Link to={`/store/produits/${p.id}`} className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-sand shrink-0 grid place-items-center">
                        {p.images?.[0]?.url
                          ? <img src={p.images[0].url} alt="" className="w-full h-full object-cover" />
                          : <ImageOff size={14} className="text-gray-300" />}
                      </div>
                      <span className="font-medium text-gray-800">{p.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5"><span className={`text-xs px-2 py-0.5 rounded-full ${BADGE[p.status]}`}>{p.status}</span></td>
                  <td className="px-4 py-2.5">{fmtPrix(p.price)}</td>
                  <td className="px-4 py-2.5"><span className={stock === 0 ? 'text-red-500' : ''}>{stock}</span></td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => retirer(p)} className="text-xs text-gray-400 hover:text-red-500">Supprimer</button>
                  </td>
                </tr>
              );
            })}
            {visibles.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">Aucun produit</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
