import React, { useEffect, useState } from 'react';
import { Trash2, Plus, ChevronDown, ChevronUp, GripVertical, Check, Upload } from 'lucide-react';
import { listerCollections, enregistrerCollection, supprimerCollection, listerProduits, majPosition, majCollection, televerserPhoto } from '../lib/admin';
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
  const [traine, setTraine] = useState(null); // { collectionId, index } de la ligne saisie
  const [modifie, setModifie] = useState(null); // id de collection dont l'ordre n'est pas encore enregistré
  const [enregistre, setEnregistre] = useState(null); // id de collection venant d'être confirmée (icône ✓ temporaire)

  const recharger = () => listerCollections().then(setCollections).catch(() => {});
  useEffect(() => { recharger(); }, []);

  async function ajouter() {
    if (!nom.trim()) return;
    await enregistrerCollection({ slug: slugifier(nom), name: nom.trim(), position: collections.length });
    setNom('');
    recharger();
  }

  // La photo de couverture est celle montrée sur la grille "Nos catégories"
  // de l'accueil — sans elle, la carte affiche juste un fond neutre.
  async function changerPhoto(c, fichier) {
    if (!fichier) return;
    const image_url = await televerserPhoto(fichier);
    await majCollection(c.id, { image_url });
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

  // Le glisser-déposer ne fait que réordonner en local — plusieurs glissés
  // rapides déclenchaient chacun leur propre écriture en base, et l'un
  // pouvait écraser le résultat d'un autre encore en vol. Un seul bouton
  // "Enregistrer" envoie l'ordre final une fois que l'admin a fini.
  function deposer(collectionId, indexCible) {
    if (!traine || traine.collectionId !== collectionId || traine.index === indexCible) { setTraine(null); return; }
    const liste = produits[collectionId];
    const reordonnee = [...liste];
    const [dep] = reordonnee.splice(traine.index, 1);
    reordonnee.splice(indexCible, 0, dep);
    setTraine(null);
    setProduits(p => ({ ...p, [collectionId]: reordonnee }));
    setModifie(collectionId);
  }

  async function enregistrerOrdre(collectionId) {
    const liste = produits[collectionId];
    setEnCours(true);
    try {
      await Promise.all(liste.map((pr, i) => pr.position === i ? null : majPosition(pr.id, i)));
      setProduits(p => ({ ...p, [collectionId]: liste.map((pr, i) => ({ ...pr, position: i })) }));
      setModifie(null);
      setEnregistre(collectionId);
      setTimeout(() => setEnregistre(e => (e === collectionId ? null : e)), 2000);
    } catch (e) {
      alert(e.message || "Échec de l'enregistrement de l'ordre");
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
            <div className="w-full flex items-center justify-between px-4 py-3 text-left">
              <button onClick={() => basculer(c)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                <div className="relative w-11 h-11 rounded bg-sand shrink-0 overflow-hidden group">
                  {c.image_url ? <img src={c.image_url} alt="" className="w-full h-full object-cover" /> : null}
                  <label onClick={(e) => e.stopPropagation()}
                    className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center cursor-pointer transition-colors">
                    <Upload size={13} className="text-white opacity-0 group-hover:opacity-100" />
                    <input type="file" accept="image/*" hidden onChange={e => changerPhoto(c, e.target.files?.[0])} />
                  </label>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-xs text-gray-400">/product-category/{c.slug}/</p>
                </div>
              </button>
              <div className="flex items-center gap-3 shrink-0">
                <span onClick={() => retirer(c)} className="text-gray-300 hover:text-red-500 p-1 cursor-pointer"><Trash2 size={16} /></span>
                <span onClick={() => basculer(c)} className="cursor-pointer">
                  {ouvert === c.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </span>
              </div>
            </div>

            {ouvert === c.id && (
              <div className="px-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] text-gray-400">Ordre d'affichage sur la page de la collection</p>
                  {modifie === c.id && (
                    <button onClick={() => enregistrerOrdre(c.id)} disabled={enCours}
                      className="flex items-center gap-1.5 bg-ink text-white text-[11px] tracking-widest uppercase px-3 py-1.5 disabled:opacity-50">
                      {enCours ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                  )}
                  {enregistre === c.id && (
                    <span className="flex items-center gap-1 text-[11px] text-green-700"><Check size={13} /> Ordre enregistré</span>
                  )}
                </div>
                {!produits[c.id] ? (
                  <p className="text-xs text-gray-300 py-3">Chargement…</p>
                ) : produits[c.id].length === 0 ? (
                  <p className="text-xs text-gray-300 py-3">Aucun produit dans cette collection.</p>
                ) : (
                  <div className="border border-gray-100 rounded-lg divide-y divide-gray-50">
                    {/* Glisser-déposer : on saisit une ligne par sa poignée et on la
                        lâche où on veut — plus rapide qu'un clic répété pour
                        descendre un produit de dix rangs. */}
                    {produits[c.id].map((pr, i) => (
                      <div key={pr.id} draggable
                        onDragStart={() => setTraine({ collectionId: c.id, index: i })}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => deposer(c.id, i)}
                        onDragEnd={() => setTraine(null)}
                        className={`flex items-center gap-3 px-3 py-2 ${traine?.collectionId === c.id && traine.index === i ? 'opacity-40' : ''}`}>
                        <GripVertical size={14} className="text-gray-300 cursor-grab shrink-0" />
                        <span className="text-[11px] text-gray-300 w-5">{i + 1}</span>
                        {pr.images?.[0]?.url
                          ? <img src={pr.images[0].url} alt="" className="w-8 h-8 object-cover bg-sand shrink-0" />
                          : <span className="w-8 h-8 bg-sand shrink-0" />}
                        <span className="text-sm flex-1 truncate">{pr.name}</span>
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
