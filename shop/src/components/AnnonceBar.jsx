import React from 'react';

/** Bandeau d'annonce — l'offre du moment, réglée depuis l'administration. */
export default function AnnonceBar({ texte }) {
  if (!texte) return null;
  return (
    <div className="bg-ink text-white text-[11px] sm:text-xs tracking-wide text-center py-2 px-4">
      {texte}
    </div>
  );
}
