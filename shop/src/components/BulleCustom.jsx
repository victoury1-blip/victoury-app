import React from 'react';

/* Une deuxième bulle flottante, réglable depuis /store/theme (image + lien
   au choix) — au-dessus de la bulle WhatsApp pour ne jamais la recouvrir.
   Absente tant qu'aucune icône n'est déposée dans les réglages. */
export default function BulleCustom({ icone, lien }) {
  if (!icone || !lien) return null;
  const externe = /^https?:\/\//.test(lien);
  return (
    <a href={lien} target={externe ? '_blank' : undefined} rel={externe ? 'noreferrer' : undefined}
      className="fixed bottom-24 right-5 z-30 w-11 h-11 rounded-full overflow-hidden shadow-lg ring-2 ring-white hover:brightness-95 transition-all">
      <img src={icone} alt="" className="w-full h-full object-cover" />
    </a>
  );
}
