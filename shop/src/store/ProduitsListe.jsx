import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ImageOff, Copy, Archive, Pencil, ExternalLink, Trash2 } from 'lucide-react';
import { listerProduits, archiverProduit, changerStatutProduit, dupliquerProduit, supprimerProduit, listerCollections, listerGroupes } from '../lib/admin';
import { fmtPrix } from '../lib/pricing';

const BADGE = { Actif: 'bg-green-50 text-green-700', Archivé: 'bg-gray-100 text-gray-500', Brouillon: 'bg-amber-50 text-amber-700' };
const STATUTS = ['Actif', 'Archivé', 'Brouillon'];

export default function ProduitsListe() {
  const [produits, setProduits] = useState(null);
  const [collections, setCollections] = useState([]);
  const [groupes, setGroupes] = useState([]);
  const [q, setQ] = useState('');
  const [collectionId, setCollectionId] = useState('');
  const [statutFiltre, setStatutFiltre] = useState('');
  const [genreFiltre, setGenreFiltre] = useState('');
  const [selection, setSelection] = useState(new Set());
  const [enCours, setEnCours] = useState(false);

  const recharger = () => listerProduits().then(setProduits).catch(() => setProduits([]));
  useEffect(() => { recharger(); }, []);
  useEffect(() => { listerCollections().then(setCollections).catch(() => {}); }, []);
  useEffect(() => { listerGroupes().then(setGroupes).catch(() => {}); }, []);

  const nomCollection = (id) => collections.find(c => c.id === id)?.name || '';
  const nomGroupe = (id) => groupes.find(g => g.id === id)?.name || '';

  async function retirer(p) {
    // Un produit vendu doit rester traçable (commandes passées) : on archive
    // plutôt que d'effacer — il disparaît de la boutique, pas de la base.
    if (p.status === 'Archivé') return;
    if (!confirm(`Archiver « ${p.name} » ? Il disparaîtra de la boutique.`)) return;
    await archiverProduit(p.id);
    recharger();
  }

  async function changerStatut(p, status) {
    if (status === p.status) return;
    setProduits(list => list.map(x => x.id === p.id ? { ...x, status } : x));
    try { await changerStatutProduit(p.id, status); }
    catch { recharger(); }
  }

  async function dupliquer(p) {
    setEnCours(true);
    try { await dupliquerProduit(p); await recharger(); }
    finally { setEnCours(false); }
  }

  async function archiverSelection() {
    if (!confirm(`Archiver les ${selection.size} produits sélectionnés ?`)) return;
    setEnCours(true);
    try {
      await Promise.all([...selection].map(id => archiverProduit(id)));
      setSelection(new Set());
      await recharger();
    } finally { setEnCours(false); }
  }

  // Suppression définitive (pas un archivage) : pour les couleurs importées
  // qui n'existent pas vraiment côté fournisseur — les garder archivées
  // encombrerait cette liste pour rien, alors qu'aucune commande ne les
  // référence encore.
  async function supprimerSelection() {
    if (!confirm(`Supprimer DÉFINITIVEMENT les ${selection.size} produits sélectionnés ? Cette action est irréversible.`)) return;
    setEnCours(true);
    try {
      await Promise.all([...selection].map(id => supprimerProduit(id)));
      setSelection(new Set());
      await recharger();
    } finally { setEnCours(false); }
  }

  if (!produits) return <p className="text-sm text-gray-400">Chargement…</p>;
  const visibles = produits.filter(p =>
    p.name.toLowerCase().includes(q.toLowerCase())
    && (!collectionId || p.collection_id === collectionId)
    && (!statutFiltre || p.status === statutFiltre)
    && (!genreFiltre || p.gender === genreFiltre)
  );
  const toutCoche = visibles.length > 0 && visibles.every(p => selection.has(p.id));

  const basculerTout = () => setSelection(toutCoche ? new Set() : new Set(visibles.map(p => p.id)));
  const basculer = (id) => setSelection(s => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-lg font-medium">Produits <span className="text-gray-400 font-normal">({produits.length} produits au total)</span></h1>
        <Link to="/store/produits/nouveau" className="flex items-center gap-2 bg-ink text-white px-4 py-2.5 text-xs tracking-wide uppercase">
          <Plus size={14} /> Ajouter un produit
        </Link>
      </div>

      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un produit…"
          className="flex-1 min-w-[200px] border border-gray-200 px-3 py-2.5 text-sm bg-white" />
        <select value={genreFiltre} onChange={e => setGenreFiltre(e.target.value)}
          className="border border-gray-200 px-3 py-2.5 text-sm bg-white">
          <option value="">Tous les genres</option>
          <option value="Femme">Femme</option>
          <option value="Homme">Homme</option>
          <option value="Unisexe">Unisexe</option>
        </select>
        <select value={collectionId} onChange={e => setCollectionId(e.target.value)}
          className="border border-gray-200 px-3 py-2.5 text-sm bg-white">
          <option value="">Toutes les collections</option>
          {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={statutFiltre} onChange={e => setStatutFiltre(e.target.value)}
          className="border border-gray-200 px-3 py-2.5 text-sm bg-white">
          <option value="">Tous les statuts</option>
          {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {selection.size > 0 && (
          <>
            <button onClick={archiverSelection} disabled={enCours}
              className="flex items-center gap-1.5 text-xs text-gray-600 border border-gray-200 px-3 py-2.5 hover:border-red-300 hover:text-red-600 disabled:opacity-50 whitespace-nowrap">
              <Archive size={13} /> Archiver ({selection.size})
            </button>
            <button onClick={supprimerSelection} disabled={enCours}
              title="Suppression définitive — pour des couleurs importées par erreur, jamais commandées"
              className="flex items-center gap-1.5 text-xs text-red-600 border border-red-200 bg-red-50 px-3 py-2.5 hover:bg-red-100 disabled:opacity-50 whitespace-nowrap">
              <Trash2 size={13} /> Supprimer ({selection.size})
            </button>
          </>
        )}
      </div>

      {/* overflow-x-auto plutôt qu'overflow-hidden : le tableau (9 colonnes)
          ne rentre pas sur un écran de téléphone — hidden coupait les
          colonnes de droite sans même indiquer qu'il y avait de quoi
          défiler, on peut maintenant glisser latéralement pour tout voir. */}
      <div className="mt-5 bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 w-10">
                <input type="checkbox" checked={toutCoche} onChange={basculerTout} aria-label="Tout sélectionner" />
              </th>
              <th className="text-left px-4 py-3">Produit</th>
              <th className="text-left px-4 py-3">Couleur</th>
              <th className="text-left px-4 py-3">Statut</th>
              <th className="text-left px-4 py-3">Collection</th>
              <th className="text-left px-4 py-3">Stock</th>
              <th className="text-left px-4 py-3">Prix</th>
              <th className="text-left px-4 py-3">Groupe</th>
              <th className="text-left px-4 py-3">Genre</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {visibles.map(p => {
              const stock = (p.sizes || []).reduce((s, x) => s + (x.stock || 0), 0);
              const stockCouleur = stock === 0 ? 'text-red-500' : stock < 5 ? 'text-amber-500' : 'text-green-600';
              return (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <input type="checkbox" checked={selection.has(p.id)} onChange={() => basculer(p.id)} aria-label={`Sélectionner ${p.name}`} />
                  </td>
                  <td className="px-4 py-2.5">
                    <Link to={`/store/produits/${p.id}`} className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-sand shrink-0 grid place-items-center rounded">
                        {p.images?.[0]?.url
                          ? <img src={p.images[0].url} alt="" className="w-full h-full object-cover rounded" />
                          : <ImageOff size={14} className="text-gray-300" />}
                      </div>
                      <div>
                        <div className="font-medium text-gray-800">{p.name}</div>
                        <div className="text-xs text-gray-400">{p.slug}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    {p.color_name ? (
                      <span className="inline-flex items-center gap-1.5 text-gray-600">
                        <span className="w-2.5 h-2.5 rounded-full border border-gray-200 shrink-0" style={{ background: p.color_hex || '#e5e5e5' }} />
                        {p.color_name}
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <select value={p.status} onChange={e => changerStatut(p, e.target.value)}
                      className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer ${BADGE[p.status]}`}>
                      {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    {nomCollection(p.collection_id)
                      ? <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{nomCollection(p.collection_id)}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5"><span className={`font-medium ${stockCouleur}`}>{stock}</span></td>
                  <td className="px-4 py-2.5">{fmtPrix(p.price)}</td>
                  <td className="px-4 py-2.5 text-gray-500">{nomGroupe(p.group_id) || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500">{p.gender || '—'}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {p.status === 'Actif' && (
                        <a href={`/product/${p.slug}/`} target="_blank" rel="noreferrer" title="Voir sur la boutique"
                          className="p-1.5 text-gray-400 hover:text-ink">
                          <ExternalLink size={14} />
                        </a>
                      )}
                      <Link to={`/store/produits/${p.id}`} title="Modifier" className="p-1.5 text-gray-400 hover:text-ink">
                        <Pencil size={14} />
                      </Link>
                      <button onClick={() => dupliquer(p)} disabled={enCours} title="Dupliquer"
                        className="p-1.5 text-gray-400 hover:text-ink disabled:opacity-50">
                        <Copy size={14} />
                      </button>
                      {p.status !== 'Archivé' && (
                        <button onClick={() => retirer(p)} disabled={enCours} title="Archiver"
                          className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-50">
                          <Archive size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {visibles.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">Aucun produit</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
