/* Réservation (précommande) d'un produit en rupture dont l'arrivage est
 * attendu : la cliente commande dès maintenant une taille à stock zéro, et la
 * commande arrive dans l'application avec la date de disponibilité en note.
 *
 * Réglée par produit depuis /store/produits (fiche produit → "Réservation"),
 * stockée dans shop_settings (clé `precommandes`, { [productId]: { date } })
 * plutôt que dans une nouvelle colonne : ajouter une colonne au SELECT du
 * catalogue avant qu'elle n'existe en base ferait tomber toute la boutique.
 * Le serveur (api/commande.js) relit ce même réglage — jamais le navigateur —
 * pour accepter une taille épuisée.
 */

const JOURS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const JOURS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const deuxChiffres = (n) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' du jour, en heure locale (pas UTC : minuit au Maroc ≠ minuit UTC). */
export function aujourdhui(now = new Date()) {
  return `${now.getFullYear()}-${deuxChiffres(now.getMonth() + 1)}-${deuxChiffres(now.getDate())}`;
}

/** Date de disponibilité si la réservation est active pour ce produit, sinon null.
    Une date passée la désactive d'elle-même : l'arrivage est censé être là. */
export function precommandeActive(precommandes, productId, now = new Date()) {
  const date = precommandes?.[productId]?.date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return date >= aujourdhui(now) ? date : null;
}

/** "lundi 02/11" / "الاثنين 02/11". */
export function dateDispo(date, ar = false) {
  const [a, m, j] = String(date).split('-').map(Number);
  const d = new Date(a, m - 1, j);
  if (Number.isNaN(d.getTime())) return date;
  const jour = (ar ? JOURS_AR : JOURS_FR)[d.getDay()];
  return `${jour} ${deuxChiffres(j)}/${deuxChiffres(m)}`;
}

/** Ligne ajoutée à la note de la commande pour chaque article réservé. */
export function noteReservation(lignes) {
  const reservees = (lignes || []).filter(l => l.precommande);
  if (!reservees.length) return '';
  return reservees
    .map(l => `⏳ RÉSERVATION — ${l.name}${l.size ? ` (${l.size})` : ''} : disponible le ${dateDispo(l.precommande)}`)
    .join('\n');
}
