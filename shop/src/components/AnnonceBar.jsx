import React, { useEffect, useState } from 'react';
import { decouperGras } from '../lib/texteEnrichi';

/* Bandeau d'annonce — l'offre du moment, réglée depuis l'administration
 * (/store/theme). Plusieurs messages tournent l'un après l'autre : montrer
 * la livraison gratuite ET la remise par quantité vaut mieux que choisir. */
export default function AnnonceBar({ theme }) {
  const messages = (theme?.annonces || []).filter(Boolean);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (messages.length < 2) return;
    const t = setInterval(() => setI(n => (n + 1) % messages.length), 4000);
    return () => clearInterval(t);
  }, [messages.length]);

  if (!theme?.annonceActive || !messages.length) return null;
  const morceaux = decouperGras(messages[i % messages.length]);

  return (
    <div
      className="text-center py-2 px-4 tracking-wide transition-colors"
      style={{ background: theme.couleurAnnonceFond || '#111111', color: theme.couleurAnnonceTexte || '#ffffff', fontSize: `${theme.tailleAnnonce || 11}px` }}
    >
      {morceaux.map((m, j) => (m.gras ? <b key={j}>{m.texte}</b> : <span key={j}>{m.texte}</span>))}
    </div>
  );
}
