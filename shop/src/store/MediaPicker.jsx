import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { listerMedias } from '../lib/admin';

/* Choisir une photo DÉJÀ déposée (logo, produit, hero…) plutôt que d'en
   re-téléverser une copie à chaque fois qu'on veut la réutiliser ailleurs —
   par exemple la même photo de logo pour une diapositive du Hero. */
export default function MediaPicker({ onChoisir, onFermer }) {
  const [medias, setMedias] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState('');

  useEffect(() => { listerMedias().then(setMedias).catch(() => {}).finally(() => setChargement(false)); }, []);

  const filtres = medias.filter(m => m.nom.toLowerCase().includes(recherche.toLowerCase()));

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onFermer}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-medium">Choisir depuis la médiathèque</h2>
          <button onClick={onFermer} aria-label="Fermer" className="p-1.5 rounded hover:bg-gray-100"><X size={16} className="text-gray-400" /></button>
        </div>
        <div className="px-5 pt-4">
          <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher…"
            className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm bg-white" />
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {chargement ? (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {Array.from({ length: 10 }).map((_, i) => <div key={i} className="aspect-square bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : filtres.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-10">Aucune photo trouvée.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {filtres.map(m => (
                <button key={m.nom} type="button" onClick={() => onChoisir(m.url)}
                  className="aspect-square bg-sand rounded-lg overflow-hidden border border-gray-200 hover:ring-2 hover:ring-ink">
                  <img src={m.url} alt={m.nom} className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
