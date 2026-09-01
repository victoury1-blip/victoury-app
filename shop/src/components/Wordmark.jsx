import React from 'react';

/* Le nom de la marque, dessiné en capitales largement espacées comme sur le
   logo. En texte plutôt qu'en image : il reste net à toutes les tailles, se lit
   par les moteurs de recherche, et ne coûte aucun chargement. */
export default function Wordmark({ className = '' }) {
  return <span className={`wordmark select-none ${className}`}>Victoury</span>;
}
