/* Adresse publique d'un produit, dérivée de son nom.
 *
 * C'est elle que porte une annonce en cours : une fois publiée, elle ne change
 * plus — d'où la saisie manuelle possible en cas de besoin, et cette
 * dérivation automatique seulement à la création.
 *
 * Module sans dépendance, pour rester éprouvable isolément. */
export function slugifier(texte) {
  return String(texte || '')
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}
