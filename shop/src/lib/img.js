// Une vignette de grille (carte produit, catégorie) n'affiche jamais plus de
// quelques centaines de pixels de large — lui servir la photo pleine
// résolution (jusqu'à 1600px depuis la compression côté admin) revient à
// télécharger bien plus que ce que l'écran montrera jamais. Supabase Storage
// sait redimensionner à la volée via son endpoint de rendu ; on le vise
// seulement pour les URLs de ce bucket, jamais pour une image d'ailleurs.
export function miniature(url, largeur) {
  if (!url || !url.includes('/storage/v1/object/public/')) return url;
  const rendu = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
  const separateur = rendu.includes('?') ? '&' : '?';
  return `${rendu}${separateur}width=${largeur}&quality=75`;
}

// Si l'endpoint de rendu n'est pas disponible sur ce projet (plan Supabase
// sans transformation d'images), la vignette échoue au chargement — on
// retombe alors sur la photo originale plutôt que de laisser une image
// cassée, silencieusement et une seule fois (pas de boucle si l'originale
// échoue aussi).
export function surErreurMiniature(e, urlOriginale) {
  const img = e.currentTarget;
  if (img.src === urlOriginale) return;
  img.src = urlOriginale;
}
