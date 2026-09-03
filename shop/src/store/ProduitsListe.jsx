import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ImageOff, Copy, Archive } from 'lucide-react';
import { listerProduits, archiverProduit, dupliquerProduit, listerCollections } from '../lib/admin';
import { fmtPrix } from '../lib/pricing';

const BADGE = { Actif: 'bg-green-50 text-green-700', Archivé: 'bg-gray-100 text-gray-500', Brouillon: 'bg-amber-50 text-amber-700' };

export default function ProduitsListe() {
  const [produits, setProduits] = useState(null);
  const [collections, setCollections] = useState([]);
  const [q, setQ] = useState('');
  const [collectionId, setCollectionId] = useState('');
  const [selection, setSelection] = useState(new Set());
  const [enCours, setEnCours] = useState(false);

  const recharger = () => listerProduits().then(setProduits).catch(() => setProduits([]));
  useEffect(() => { recharger(); }, []);
  useEffect(() => { listerCollections().then(setCollections).catch(() => {}); }, []);

  async function retirer(p) {
    // Un produit vendu doit rester traçable (commandes passées) : on archive
    // plutôt que d'effacer — il disparaît de la boutique, pas de la base.
    if (p.status === 'Archivé') return;
    if (!confirm(`Archiver « ${p.name} » ? Il disparaîtra de la boutique.`)) return;
    await archiverProduit(p.id);
    recharger();
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

  if (!produits) return <p className="text-sm text-gray-400">Chargement…</p>;
  const visibles = produits.filter(p =>
    p.name.toLowerCase().includes(q.toLowerCase()) && (!collectionId || p.collection_id === collectionId)
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
        <h1 className="text-lg font-medium">Produits <span className="text-gray-400 font-normal">({produits.length})</span></h1>
        <Link to="/store/produits/nouveau" className="flex items-center gap-2 bg-ink text-white px-4 py-2.5 text-xs tracking-wide uppercase">
          <Plus size={14} /> Ajouter un produit
        </Link>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un produit…"
          className="w-full max-w-sm border border-gray-200 px-3 py-2.5 text-sm bg-white" />
        <select value={collectionId} onChange={e => setCollectionId(e.target.value)}
          className="border border-gray-200 px-3 py-2.5 text-sm bg-white">
          <option value="">Toutes les collections</option>
          {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {selection.size > 0 && (
          <button onClick={archiverSelection} disabled={enCours}
            className="flex items-center gap-1.5 text-xs text-gray-600 border border-gray-200 px-3 py-2.5 hover:border-red-300 hover:text-red-600 disabled:opacity-50 whitespace-nowrap">
            <Archive size={13} /> Archiver ({selection.size})
          </button>
        )}
      </div>

      <div className="mt-5 bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 w-10">
                <input type="checkbox" checked={toutCoche} onChange={basculerTout} aria-label="Tout sélectionner" />
              </th>
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
                    <input type="checkbox" checked={selection.has(p.id)} onChange={() => basculer(p.id)} aria-label={`Sélectionner ${p.name}`} />
                  </td>
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
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
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
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Aucun produit</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
