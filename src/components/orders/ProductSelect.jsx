import React, { useEffect, useRef, useState } from 'react';

/* Remplace le <select> natif pour le choix d'un produit dans une commande —
   la liste (souvent 50+ produits) est illisible dans le picker natif du
   téléphone sans recherche. Les articles "Ensemble Sport…" remontent en
   premier (c'est la catégorie la plus vendue), le reste suit par ordre
   alphabétique. */
export default function ProductSelect({ value, onChange, products, placeholder = '-- Choisir un produit --' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function surClicExterieur(e) {
      if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQuery(''); }
    }
    document.addEventListener('mousedown', surClicExterieur);
    return () => document.removeEventListener('mousedown', surClicExterieur);
  }, []);

  const tries = [...products].sort((a, b) => {
    const aEnsemble = a.name.toLowerCase().startsWith('ensemble sport');
    const bEnsemble = b.name.toLowerCase().startsWith('ensemble sport');
    if (aEnsemble !== bEnsemble) return aEnsemble ? -1 : 1;
    return a.name.localeCompare(b.name, 'fr');
  });
  const filtres = query.trim()
    ? tries.filter(p => p.name.toLowerCase().includes(query.trim().toLowerCase()))
    : tries;

  function choisir(nom) {
    onChange(nom);
    setOpen(false);
    setQuery('');
  }

  return (
    <div className="relative flex-1 min-w-0" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`w-full text-left border border-gray-200 rounded-lg px-2.5 py-2 text-sm truncate bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 ${value ? 'text-gray-800' : 'text-gray-400'}`}>
        {value || placeholder}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher un produit…"
            className="w-full px-2.5 py-2 text-sm border-b border-gray-100 focus:outline-none sticky top-0 bg-white" />
          <button type="button" onClick={() => choisir('')} className="w-full text-left px-2.5 py-2 text-sm text-gray-400 hover:bg-gray-50">
            {placeholder}
          </button>
          {/* Article déjà sur la commande mais absent du catalogue (retiré,
              d'affiliation…) — reste sélectionnable, jamais effacé de la liste. */}
          {value && !products.some(p => p.name === value) && (
            <button type="button" onClick={() => choisir(value)} className="w-full text-left px-2.5 py-2 text-sm text-gray-800 hover:bg-blue-50">
              {value}
            </button>
          )}
          {filtres.map(p => (
            <button key={p.id} type="button" onClick={() => choisir(p.name)}
              className="w-full text-left px-2.5 py-2 text-sm text-gray-800 hover:bg-blue-50">
              {p.name}
            </button>
          ))}
          {!filtres.length && <p className="px-2.5 py-3 text-xs text-gray-300 text-center">Aucun résultat</p>}
        </div>
      )}
    </div>
  );
}
