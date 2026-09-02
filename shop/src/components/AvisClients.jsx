import React, { useState } from 'react';
import { X } from 'lucide-react';

/* Rien ne s'affiche tant que l'admin n'a déposé aucune capture — pas de
   galerie vide qui donnerait un mauvais signal de confiance. */
export default function AvisClients({ avis }) {
  const [ouvert, setOuvert] = useState(null);
  if (!avis?.length) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-16">
      <h2 className="text-center text-sm tracking-[0.2em] uppercase text-gray-500">Avis clients</h2>
      <div className="mt-8 flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {avis.map(a => (
          <button key={a.id} type="button" onClick={() => setOuvert(a.url)} className="shrink-0">
            <img src={a.url} alt="Avis client"
              className="w-44 sm:w-56 aspect-[3/4] object-cover rounded-lg border border-gray-100 cursor-zoom-in hover:opacity-90 transition-opacity" />
          </button>
        ))}
      </div>

      {/* Zoom plein écran : la capture montrée en miniature reste illisible
          (texte de conversation) tant qu'on ne peut pas l'agrandir. */}
      {ouvert && (
        <div className="fixed inset-0 z-50 bg-black/80 grid place-items-center p-4" onClick={() => setOuvert(null)}>
          <button type="button" onClick={() => setOuvert(null)} aria-label="Fermer"
            className="absolute top-4 right-4 text-white/80 hover:text-white">
            <X size={28} />
          </button>
          <img src={ouvert} alt="Avis client" className="max-w-full max-h-full rounded-lg" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </section>
  );
}
