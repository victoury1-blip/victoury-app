import React from 'react';
import { decouperGras } from '../lib/texteEnrichi';
import { useLang } from '../lib/i18n';

/* Bandeau d'annonce — l'offre du moment, réglée depuis l'administration
 * (/store/theme). Plusieurs messages tournent l'un après l'autre, séparés
 * par un point : un défilement continu droite → gauche (comme un bandeau
 * boursier) plutôt qu'un texte qui saute d'un message à l'autre — bien plus
 * lisible, et rien à cliquer ou attendre pour voir la suite. Rotation
 * propre à chaque langue (annoncesAr) — un bandeau en français pendant
 * qu'on lit le reste du site en arabe se remarque tout de suite. */
export default function AnnonceBar({ theme }) {
  const { lang } = useLang();
  const source = lang === 'ar' && theme?.annoncesAr?.length ? theme.annoncesAr : theme?.annonces;
  const messages = (source || []).filter(Boolean);

  if (!theme?.annonceActive || !messages.length) return null;

  const texteComplet = messages.join('   ·   ');
  const morceaux = decouperGras(texteComplet);
  // Vitesse constante quel que soit le nombre de messages réglés : un texte
  // deux fois plus long doit prendre deux fois plus de temps à défiler,
  // sinon un bandeau court paraîtrait figé et un long, affolé.
  const duree = Math.max(8, texteComplet.length * 0.16);

  const contenu = (cle) => (
    <span key={cle} className="inline-flex shrink-0 px-6">
      {morceaux.map((m, j) => (m.gras ? <b key={j}>{m.texte}</b> : <span key={j}>{m.texte}</span>))}
    </span>
  );

  return (
    <div
      className="py-2 overflow-hidden transition-colors"
      style={{
        background: theme.couleurAnnonceFond || '#111111', color: theme.couleurAnnonceTexte || '#ffffff',
        fontSize: `${theme.tailleAnnonce || 11}px`, fontWeight: theme.epaisseurAnnonce || 'normal',
      }}
    >
      <div className="flex w-max whitespace-nowrap tracking-wide" style={{ animation: `annonce-defile ${duree}s linear infinite` }}>
        {contenu('a')}
        {contenu('b')}
      </div>
    </div>
  );
}
