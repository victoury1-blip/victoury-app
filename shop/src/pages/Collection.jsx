import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import CarteProduit from '../components/CarteProduit';
import { chargerProduitsDeCollection } from '../lib/catalog';

export default function Collection({ theme }) {
  const { slug } = useParams();
  const [etat, setEtat] = useState({ chargement: true, collection: null, produits: [] });
  const [taille, setTaille] = useState('');

  useEffect(() => {
    setEtat(e => ({ ...e, chargement: true }));
    chargerProduitsDeCollection(slug)
      .then(r => setEtat({ chargement: false, ...r }))
      .catch(() => setEtat({ chargement: false, collection: null, produits: [] }));
  }, [slug]);

  // Réglable depuis /store/theme : superflu quand la collection ne mélange
  // pas de tailles disparates.
  const filtreActif = theme?.collectionFiltreTaille !== false;
  const tailles = filtreActif
    ? [...new Set(etat.produits.flatMap(p => (p.sizes || []).filter(s => s.stock > 0).map(s => s.size)))]
    : [];
  const visibles = taille
    ? etat.produits.filter(p => (p.sizes || []).some(s => s.size === taille && s.stock > 0))
    : etat.produits;

  if (etat.chargement) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="animate-pulse"><div className="bg-gray-100 aspect-[4/5]" /><div className="h-3 bg-gray-100 mt-3 w-2/3" /></div>
        ))}
      </div>
    );
  }

  if (!etat.collection) {
    return <p className="max-w-7xl mx-auto px-6 py-24 text-center text-sm text-gray-400">Cette collection n'existe pas.</p>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-lg tracking-[0.2em] uppercase">{etat.collection.name}</h1>
        {tailles.length > 0 && (
          <select value={taille} onChange={e => setTaille(e.target.value)}
            className="border border-gray-200 px-3 py-2 text-xs tracking-wide uppercase bg-white"
            aria-label="Filtrer par taille">
            <option value="">Toutes les tailles</option>
            {tailles.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>
      {etat.collection.description && (
        <p className="mt-3 text-sm text-gray-500 max-w-2xl">{etat.collection.description}</p>
      )}

      {visibles.length === 0 ? (
        <p className="py-24 text-center text-sm text-gray-400">Aucun article disponible dans cette taille.</p>
      ) : (
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10">
          {visibles.map(p => <CarteProduit key={p.id} produit={p} />)}
        </div>
      )}
    </div>
  );
}
