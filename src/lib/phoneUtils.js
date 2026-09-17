/* Normalisation des numéros de téléphone marocains.
 *
 * Le même abonné s'écrit de plusieurs façons selon la source : « +212612345678 »
 * chez le transporteur, « 0612345678 » dans la commande, « 612345678 » depuis un
 * tableur qui a pris le numéro pour un nombre et mangé le zéro initial.
 * Comparer ces chaînes telles quelles fait conclure à tort qu'il s'agit de deux
 * clients différents.
 */
export function normalizePhone(p) {
  // Ne garder que les chiffres : au-delà des espaces/tirets/points/plus déjà
  // visibles, une valeur venue d'une API tierce (Ozon Express, panneau
  // arabe) peut transporter des caractères invisibles — marques de sens de
  // lecture (LRM/RLM U+200E/U+200F), espace insécable — qui ne se VOIENT
  // jamais à l'écran mais empêchent deux numéros identiques de comparer égaux
  // (===). C'est exactement ce qui déclenchait une fausse alerte « ce code
  // d'envoi appartient à une autre commande » sur un numéro pourtant identique
  // au pixel près dans les deux panneaux.
  let s = (p || '').replace(/\D/g, '').replace(/^(00212|212)/, '0');
  // Google Sheets stocke le téléphone comme un nombre et supprime le 0 initial
  // (ex: 0709015213 → 709015213). On le rétablit pour les numéros marocains.
  if (/^[5-7]\d{8}$/.test(s)) s = '0' + s;
  return s;
}

/** Deux numéros désignent-ils le même abonné ?
 *  Un numéro absent ne contredit rien : on ne conclut pas sur du vide. */
export function samePhone(a, b) {
  const x = normalizePhone(a);
  const y = normalizePhone(b);
  if (!x || !y) return true;
  return x === y;
}
