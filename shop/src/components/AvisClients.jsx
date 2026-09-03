import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

/* Rien ne s'affiche tant que l'admin n'a déposé aucune capture — pas de
   galerie vide qui donnerait un mauvais signal de confiance. */
export default function AvisClients({ avis }) {
  const [ouvert, setOuvert] = useState(null);
  const pisteRef = useRef(null);

  // Défilement automatique vers la gauche : une capture à peine visible
  // dans le coin ne donne pas envie de la faire glisser soi-même — un
  // léger mouvement toutes les 3 s donne à voir qu'il y en a d'autres.
  // En pause tant qu'un doigt (ou la souris) est sur la piste.
  useEffect(() => {
    if (!avis?.length || avis.length < 2) return;
    const piste = pisteRef.current;
    if (!piste) return;
    let enPause = false;
    const id = setInterval(() => {
      if (enPause || !piste) return;
      const largeurCarte = piste.firstElementChild?.getBoundingClientRect().width || 0;
      const pas = largeurCarte + 16; // gap-4
      const findu = piste.scrollLeft + piste.clientWidth >= piste.scrollWidth - 4;
      piste.scrollTo({ left: findu ? 0 : piste.scrollLeft + pas, behavior: 'smooth' });
    }, 3000);
    const surPause = () => { enPause = true; };
    const surReprise = () => { enPause = false; };
    piste.addEventListener('pointerdown', surPause);
    piste.addEventListener('pointerup', surReprise);
    piste.addEventListener('mouseenter', surPause);
    piste.addEventListener('mouseleave', surReprise);
    return () => {
      clearInterval(id);
      piste.removeEventListener('pointerdown', surPause);
      piste.removeEventListener('pointerup', surReprise);
      piste.removeEventListener('mouseenter', surPause);
      piste.removeEventListener('mouseleave', surReprise);
    };
  }, [avis?.length]);

  if (!avis?.length) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-16">
      <h2 className="text-center text-sm tracking-[0.2em] uppercase text-gray-500">Avis clients</h2>
      <div ref={pisteRef} className="mt-8 flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {avis.map(a => (
          <button key={a.id} type="button" onClick={() => setOuvert(a.url)} className="shrink-0">
            <img src={a.url} alt="Avis client"
              className="w-52 sm:w-64 aspect-[3/4] object-cover rounded-lg border border-gray-100 cursor-zoom-in hover:opacity-90 transition-opacity" />
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
