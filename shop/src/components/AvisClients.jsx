import React from 'react';

/* Rien ne s'affiche tant que l'admin n'a déposé aucune capture — pas de
   galerie vide qui donnerait un mauvais signal de confiance. */
export default function AvisClients({ avis }) {
  if (!avis?.length) return null;
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-16">
      <h2 className="text-center text-sm tracking-[0.2em] uppercase text-gray-500">Avis clients</h2>
      <div className="mt-8 flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {avis.map(a => (
          <img key={a.id} src={a.url} alt="Avis client"
            className="w-44 sm:w-56 aspect-[3/4] object-cover shrink-0 rounded-lg border border-gray-100" />
        ))}
      </div>
    </section>
  );
}
