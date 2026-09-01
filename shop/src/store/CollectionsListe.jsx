import React, { useEffect, useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { listerCollections, enregistrerCollection, supprimerCollection } from '../lib/admin';
import { slugifier } from '../lib/slug';

const champ = 'border border-gray-200 px-3 py-2 text-sm bg-white';

export default function CollectionsListe() {
  const [collections, setCollections] = useState([]);
  const [nom, setNom] = useState('');

  const recharger = () => listerCollections().then(setCollections).catch(() => {});
  useEffect(() => { recharger(); }, []);

  async function ajouter() {
    if (!nom.trim()) return;
    await enregistrerCollection({ slug: slugifier(nom), name: nom.trim(), position: collections.length });
    setNom('');
    recharger();
  }

  async function retirer(c) {
    // Les produits qu'elle contenait ne sont pas supprimés : ils perdent
    // seulement leur rattachement, et restent modifiables.
    if (!confirm(`Supprimer « ${c.name} » ? Les produits qu'elle contient ne seront pas supprimés.`)) return;
    await supprimerCollection(c.id);
    recharger();
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-medium">Collections</h1>
      <div className="mt-4 flex gap-2">
        <input value={nom} onChange={e => setNom(e.target.value)} onKeyDown={e => e.key === 'Enter' && ajouter()}
          placeholder="Nom de la collection" className={`${champ} flex-1`} />
        <button onClick={ajouter} className="flex items-center gap-1.5 bg-ink text-white px-4 text-xs tracking-widest uppercase">
          <Plus size={14} /> Ajouter
        </button>
      </div>

      <div className="mt-5 bg-white border border-gray-200 rounded-xl divide-y divide-gray-50">
        {collections.map(c => (
          <div key={c.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">{c.name}</p>
              <p className="text-xs text-gray-400">/product-category/{c.slug}/</p>
            </div>
            <button onClick={() => retirer(c)} className="text-gray-300 hover:text-red-500"><Trash2 size={16} /></button>
          </div>
        ))}
        {collections.length === 0 && <p className="px-4 py-8 text-center text-sm text-gray-400">Aucune collection</p>}
      </div>
    </div>
  );
}
