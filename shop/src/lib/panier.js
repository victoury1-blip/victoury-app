/* Le panier du visiteur.
 *
 * Il vit dans le navigateur : le client compose sa commande, ferme l'onglet,
 * revient le soir. Perdre son panier entre-temps, c'est perdre la vente.
 *
 * Une ligne est identifiée par le couple produit + taille : le même modèle en
 * 40 et en 42 sont deux lignes, tandis que le même en 40 ajouté deux fois n'en
 * fait qu'une, de quantité 2.
 */
const CLE = 'victoury_panier';

export const cleLigne = (l) => `${l.slug}::${l.size || ''}`;

export function lirePanier() {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) || '[]');
    return Array.isArray(brut) ? brut.filter(l => l?.slug && l?.qty > 0) : [];
  } catch { return []; }
}

export function ecrirePanier(lignes) {
  try { localStorage.setItem(CLE, JSON.stringify(lignes)); } catch { /* quota */ }
  // Les autres onglets ouverts doivent voir le même panier.
  try { window.dispatchEvent(new CustomEvent('panier:maj')); } catch { /* hors navigateur */ }
  return lignes;
}

/** Ajoute une ligne, ou augmente celle qui existe déjà. */
export function ajouter(lignes, ligne, qty = 1) {
  const cle = cleLigne(ligne);
  const existe = lignes.find(l => cleLigne(l) === cle);
  if (existe) {
    return lignes.map(l => (cleLigne(l) === cle ? { ...l, qty: borner(l.qty + qty, l.stock) } : l));
  }
  return [...lignes, { ...ligne, qty: borner(qty, ligne.stock) }];
}

export function changerQuantite(lignes, cle, qty) {
  const n = Number(qty);
  if (!Number.isFinite(n) || n < 1) return lignes.filter(l => cleLigne(l) !== cle);
  return lignes.map(l => (cleLigne(l) === cle ? { ...l, qty: borner(n, l.stock) } : l));
}

export const retirer = (lignes, cle) => lignes.filter(l => cleLigne(l) !== cle);

export const vider = () => ecrirePanier([]);

/* On ne vend pas ce qu'on n'a pas : la quantité ne dépasse jamais le stock
   connu de la taille. Sans stock renseigné, une limite haute évite seulement
   les saisies absurdes. */
function borner(n, stock) {
  const max = Number.isFinite(stock) && stock > 0 ? stock : 99;
  return Math.max(1, Math.min(Math.floor(n), max));
}
