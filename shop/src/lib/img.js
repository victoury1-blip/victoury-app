// Une vignette de grille (carte produit, catégorie) n'affiche jamais plus de
// quelques centaines de pixels de large — la photo pleine résolution
// (jusqu'à 1600px) est un aller-retour bien plus lourd que nécessaire. Une
// première tentative appelait l'endpoint de transformation d'image de
// Supabase Storage à la volée : indisponible/trop lent sur ce projet, il a
// fait chuter le score de performance au lieu de l'améliorer. La miniature
// est maintenant un vrai fichier statique, généré une fois au dépôt (voir
// admin.js), stocké à côté de l'original avec le suffixe "-thumb".
export function miniature(url) {
  if (!url || !url.includes('/storage/v1/object/public/boutique/')) return url;
  return url.replace(/\.[^./]+$/, '-thumb.webp');
}

// Le Hero (bannière plein écran) a besoin de bien plus que les quelques
// centaines de pixels d'une vignette de grille — la miniature 500px y
// rendait flou tout texte fin incrusté dans la photo (légende d'un visuel
// Canva, par exemple). Une miniature 960px dédiée (voir admin.js) reste
// plus légère que l'originale (jusqu'à 1600px) tout en gardant ce texte net.
export function miniatureHero(url) {
  if (!url || !url.includes('/storage/v1/object/public/boutique/')) return url;
  return url.replace(/\.[^./]+$/, '-hero.webp');
}

// Une photo déposée avant l'ajout de cette fonctionnalité n'a pas de
// miniature associée — l'appel 404 alors une seule fois, et on retombe sur
// l'originale plutôt que de laisser une image cassée.
export function surErreurMiniature(e, urlOriginale) {
  const img = e.currentTarget;
  if (img.src === urlOriginale) return;
  img.src = urlOriginale;
}
