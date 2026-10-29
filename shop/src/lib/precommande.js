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

/* ── Commandes réservées ──
 * Une commande avec au moins un article réservé porte recipient.reservation
 * = { date, envoyee: false } : l'application la garde hors de « À Confirmer »
 * jusqu'à ce que l'arrivage soit là et qu'on l'y envoie depuis
 * /store/reservations (envoyee: true). Les toutes premières réservations,
 * passées avant ce champ, se reconnaissent à leur note « ⏳ RÉSERVATION ». */

const RE_NOTE = /⏳\s*RÉSERVATION/i;

/** Le jeu d'informations à poser sur la commande, ou null sans réservation. */
export function infoReservation(lignes) {
  const dates = (lignes || []).map(l => l.precommande).filter(Boolean).sort();
  return dates.length ? { date: dates[dates.length - 1], envoyee: false } : null;
}

/** Commande réservée encore en attente de l'arrivage. */
export function reservationEnAttente(o) {
  if (!o || o.is_deleted || o.status !== 'nouveau') return false;
  const r = o.recipient?.reservation;
  if (r) return !r.envoyee;
  return RE_NOTE.test(o.note || '');
}

/** Date d'arrivage ('YYYY-MM-DD') — du champ, ou relue dans la note des anciennes. */
export function dateReservation(o, now = new Date()) {
  if (o?.recipient?.reservation?.date) return o.recipient.reservation.date;
  const m = /disponible le \S+ (\d{2})\/(\d{2})/i.exec(o?.note || '');
  if (!m) return null;
  return `${now.getFullYear()}-${m[2]}-${m[1]}`;
}

/** Message WhatsApp envoyé à la cliente : commande bien reçue, on la
    rappelle à l'arrivage pour confirmer. `offre` = texte de l'offre en
    cours (ex. « جوج ب 499 درهم بلاصة 580 »), facultatif. */
export function messageReservation(o, offre = '') {
  const nom = (o?.recipient?.name || '').trim();
  const produits = (o?.products?.length ? o.products : [o?.product]).filter(p => p?.name);
  const nbPieces = produits.reduce((n, p) => n + (Number(p.qty) || 1), 0);
  const date = dateReservation(o);
  const lignes = [
    `السلام عليكم${nom ? ' ' + nom : ''} 😊`,
    'معاك Victoury 🌸 توصلنا بالطلب ديالك:',
    ...produits.map(p => `• ${p.name}${p.size ? ` — المقاس ${p.size}` : ''}${(Number(p.qty) || 1) > 1 ? ` ×${p.qty}` : ''}`),
    `💰 الثمن: ${Number(o?.price || 0).toLocaleString('fr-FR')} درهم — التوصيل فابور، والدفع عند الاستلام`,
  ];
  if (offre) {
    lignes.push(nbPieces >= 2
      ? `🎁 استافدتي من العرض: ${offre}`
      : `🎁 عرض خاص: ${offre} — إلا بغيتي تزيدي لون آخر قولي لينا`);
  }
  lignes.push(
    date
      ? `⏳ السلعة غتوجد نهار ${dateDispo(date, true)}، وغنعاودو نتواصلو معاك باش نأكدو معاك الطلب.`
      : '⏳ ملي توجد السلعة غنعاودو نتواصلو معاك باش نأكدو معاك الطلب.',
    'شكرا على الثقة ديالك 🙏',
  );
  return lignes.join('\n');
}
