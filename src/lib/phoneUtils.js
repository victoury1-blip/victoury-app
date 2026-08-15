/* Normalisation des numéros de téléphone marocains.
 *
 * Le même abonné s'écrit de plusieurs façons selon la source : « +212612345678 »
 * chez le transporteur, « 0612345678 » dans la commande, « 612345678 » depuis un
 * tableur qui a pris le numéro pour un nombre et mangé le zéro initial.
 * Comparer ces chaînes telles quelles fait conclure à tort qu'il s'agit de deux
 * clients différents.
 */
export function normalizePhone(p) {
  let s = (p || '').replace(/[\s\-.+]/g, '').replace(/^(00212|212)/, '0');
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
