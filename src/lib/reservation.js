/* Commande réservée sur la boutique (taille en rupture, arrivage attendu) :
 * elle reste hors de « À Confirmer » tant que l'admin ne l'y a pas envoyée
 * depuis /store/reservations (recipient.reservation.envoyee). Les toutes
 * premières réservations, d'avant ce champ, se reconnaissent à leur note.
 * Même règle que shop/src/lib/precommande.js (reservationEnAttente). */
const RE_NOTE = /⏳\s*RÉSERVATION/i;

export function reservationEnAttente(o) {
  if (!o || o.status !== 'nouveau') return false;
  const r = o.recipient?.reservation;
  if (r) return !r.envoyee;
  return RE_NOTE.test(o.note || '');
}
