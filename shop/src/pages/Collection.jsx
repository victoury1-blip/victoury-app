import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import CarteProduit from '../components/CarteProduit';
import AvisClients from '../components/AvisClients';
import { chargerProduitsDeCollection, chargerAvis } from '../lib/catalog';

// Combien de fiches à la fois : le premier écran, puis un lot de plus à
// chaque défilement — un client qui scrolle 200 fiches d'un coup n'existe
// pas, mais tout charger sans jamais rien afficher progressivement fait
// paraître la page figée, sans le petit "ça continue à charger" des autres
// sites.
const LOT = 8;

export default function Collection({ theme, remises }) {
  const { slug } = useParams();
  const [etat, setEtat] = useState({ chargement: true, collection: null, produits: [] });
  const [taille, setTaille] = useState('');
  const [avis, setAvis] = useState([]);
  const [nbAffiches, setNbAffiches] = useState(LOT);
  const sentinelleRef = useRef(null);

  useEffect(() => {
    setEtat(e => ({ ...e, chargement: true }));
    setNbAffiches(LOT);
    chargerProduitsDeCollection(slug)
      .then(r => setEtat({ chargement: false, ...r }))
      .catch(() => setEtat({ chargement: false, collection: null, produits: [] }));
  }, [slug]);

  // Un changement de filtre taille repart du même petit lot — sinon une
  // sélection qui réduit la liste de 40 à 6 articles laisserait `nbAffiches`
  // à 32, sans effet visible ni logique.
  useEffect(() => { setNbAffiches(LOT); }, [taille]);

  useEffect(() => {
    const cible = sentinelleRef.current;
    if (!cible) return;
    const observateur = new IntersectionObserver(([entree]) => {
      if (entree.isIntersecting) setNbAffiches(n => n + LOT);
    }, { rootMargin: '600px' }); // avance l'appel avant que le bas ne soit visible — pas de blanc pendant le scroll
    observateur.observe(cible);
    return () => observateur.disconnect();
  }, [etat.produits, taille]);

  useEffect(() => { chargerAvis().then(setAvis).catch(() => {}); }, []);

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
        <>
          <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10">
            {visibles.slice(0, nbAffiches).map(p => <CarteProduit key={p.id} produit={p} remises={remises} />)}
          </div>
          {/* Invisible : sert juste à détecter qu'on approche du bas pour
              afficher le lot suivant, sans bouton "voir plus" à cliquer. */}
          {nbAffiches < visibles.length && <div ref={sentinelleRef} className="h-1" />}
        </>
      )}

      <AvisClients avis={avis} />
    </div>
  );
}
