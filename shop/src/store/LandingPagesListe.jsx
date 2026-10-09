import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ImageOff, ExternalLink, Trash2 } from 'lucide-react';
import { listerProduits, supprimerProduit } from '../lib/admin';
import { fmtPrix } from '../lib/pricing';

/* Liste des produits "non listés" uniquement — une landing page de pub,
   jamais mélangée aux fiches du catalogue (voir ProduitsListe.jsx, qui
   montre tout sauf celles-ci — un produit n'apparaît que dans l'une des
   deux listes, jamais les deux). */
export default function LandingPagesListe() {
  const [liste, setListe] = useState(null);

  const recharger = () => listerProduits().then(ps => setListe(ps.filter(p => p.unlisted))).catch(() => setListe([]));
  useEffect(() => { recharger(); }, []);

  async function retirer(p) {
    if (!confirm(`Supprimer "${p.name}" ?`)) return;
    await supprimerProduit(p.id);
    recharger();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-medium">Landing pages</h1>
          <p className="text-xs text-gray-400 mt-0.5">Pages de vente dédiées à une pub — accessibles uniquement par leur lien direct.</p>
        </div>
        <Link to="/store/landing-pages/nouveau"
          className="flex items-center gap-1.5 bg-ink text-white px-4 py-2.5 text-xs tracking-widest uppercase">
          <Plus size={14} /> Nouvelle page
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Page</th>
              <th className="px-4 py-3 text-left font-medium">Lien</th>
              <th className="px-4 py-3 text-left font-medium">Prix</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {liste === null && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Chargement…</td></tr>}
            {liste?.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Aucune landing page pour le moment.</td></tr>
            )}
            {liste?.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <Link to={`/store/landing-pages/${p.id}`} className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-sand shrink-0 grid place-items-center rounded">
                      {p.images?.[0]?.url
                        ? <img src={p.images[0].url} alt="" className="w-full h-full object-cover rounded" />
                        : <ImageOff size={14} className="text-gray-300" />}
                    </div>
                    <span className="font-medium text-gray-800">{p.name}</span>
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-gray-500">victoury-maroc.com/{p.slug}</td>
                <td className="px-4 py-2.5">{fmtPrix(p.price)}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    <a href={`/${p.slug}/`} target="_blank" rel="noreferrer" title="Voir la page"
                      className="p-1.5 rounded text-gray-400 hover:bg-gray-100"><ExternalLink size={14} /></a>
                    <button onClick={() => retirer(p)} title="Supprimer" className="p-1.5 rounded text-red-400 hover:bg-red-50">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
