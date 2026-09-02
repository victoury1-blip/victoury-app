import React, { useEffect, useState } from 'react';
import { Trash2, Plus, ChevronDown, ChevronUp, ArrowUp, ArrowDown } from 'lucide-react';
import { listerCollections, enregistrerCollection, supprimerCollection, listerProduits, enregistrerProduit } from '../lib/admin';
import { slugifier } from '../lib/slug';

const champ = 'border border-gray-200 px-3 py-2 text-sm bg-white';

// Les produits sans position réglée (0 partout par défaut) gardent un ordre
// stable en s'appuyant sur leur date de création plutôt que de se mélanger
// à chaque rechargement.
const trierProduits = (ps) => [...ps].sort((a, b) => (a.position - b.position) || a.name.localeCompare(b.name));

export default function CollectionsListe() {
  const [collections, setCollections] = useState([]);
  const [nom, setNom] = useState('');
  const [ouvert, setOuvert] = useState(null);
  const [produits, setProduits] = useState({});
  const [enCours, setEnCours] = useState(false);

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

  async function basculer(c) {
    if (ouvert === c.id) { setOuvert(null); return; }
    setOuvert(c.id);
    if (produits[c.id]) return;
    const tous = await listerProduits();
    setProduits(p => ({ ...p, [c.id]: trierProduits(tous.filter(pr => pr.collection_id === c.id)) }));
  }

  // L'ordre ici décide de l'ordre affiché sur la page de la collection — les
  // positions se réattribuent 0, 1, 2… pour que le prochain tri reste stable
  // même si elles étaient toutes à 0 au départ.
  async function deplacer(collectionId, index, sens) {
    const liste = produits[collectionId];
    const j = index + sens;
    if (j < 0 || j >= liste.length || enCours) return;
    setEnCours(true);
    const reordonnee = [...liste];
    [reordonnee[index], reordonnee[j]] = [reordonnee[j], reordonnee[index]];
    setProduits(p => ({ ...p, [collectionId]: reordonnee }));
    try {
      await Promise.all(reordonnee.map((pr, i) => pr.position === i ? null : enregistrerProduit({ id: pr.id, position: i })));
      setProduits(p => ({ ...p, [collectionId]: reordonnee.map((pr, i) => ({ ...pr, position: i })) }));
    } finally {
      setEnCours(false);
    }
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
          <div key={c.id}>
            <button onClick={() => basculer(c)} className="w-full flex items-center justify-between px-4 py-3 text-left">
              <div>
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-xs text-gray-400">/product-category/{c.slug}/</p>
              </div>
              <div className="flex items-center gap-3">
                <span onClick={(e) => { e.stopPropagation(); retirer(c); }} className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={16} /></span>
                {ouvert === c.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </div>
            </button>

            {ouvert === c.id && (
              <div className="px-4 pb-4">
                <p className="text-[11px] text-gray-400 mb-2">Ordre d'affichage sur la page de la collection</p>
                {!produits[c.id] ? (
                  <p className="text-xs text-gray-300 py-3">Chargement…</p>
                ) : produits[c.id].length === 0 ? (
                  <p className="text-xs text-gray-300 py-3">Aucun produit dans cette collection.</p>
                ) : (
                  <div className="border border-gray-100 rounded-lg divide-y divide-gray-50">
                    {produits[c.id].map((pr, i) => (
                      <div key={pr.id} className="flex items-center gap-3 px-3 py-2">
                        <span className="text-[11px] text-gray-300 w-5">{i + 1}</span>
                        {pr.images?.[0]?.url
                          ? <img src={pr.images[0].url} alt="" className="w-8 h-8 object-cover bg-sand shrink-0" />
                          : <span className="w-8 h-8 bg-sand shrink-0" />}
                        <span className="text-sm flex-1 truncate">{pr.name}</span>
                        <button onClick={() => deplacer(c.id, i, -1)} disabled={i === 0 || enCours}
                          className="p-1 text-gray-400 hover:text-ink disabled:opacity-20" aria-label="Monter">
                          <ArrowUp size={14} />
                        </button>
                        <button onClick={() => deplacer(c.id, i, 1)} disabled={i === produits[c.id].length - 1 || enCours}
                          className="p-1 text-gray-400 hover:text-ink disabled:opacity-20" aria-label="Descendre">
                          <ArrowDown size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {collections.length === 0 && <p className="px-4 py-8 text-center text-sm text-gray-400">Aucune collection</p>}
      </div>
    </div>
  );
}
