import { A_CONFIRMER_STATUSES } from '../data/colisPipeline';
import { cloudSet } from './cloudSettings';

/* ── Série des codes de suivi : VIxxxxx ─────────────────────────────────────
 *
 * Les séries précédentes (VICTxxxx puis VICTOURYxxxx) traînent un historique de
 * numéros erronés, restés dans les onglets et chez le transporteur. Toute règle
 * qui déduisait le prochain numéro de l'existant se retrouvait tirée vers le
 * haut par le moindre code oublié.
 *
 * D'où une série NEUVE, avec un préfixe qui ne peut pas se confondre avec les
 * anciennes : `VI` est suivi de chiffres, alors que `VICT0002` a un `C` à cette
 * place — les deux formats ne se croisent donc jamais. Elle repart de 1.
 *
 * Elle ne se calcule QUE sur les commandes « À Confirmer » : ni la Liste des
 * Colis, ni « En Suivi », ni « Confirmé » n'influencent la suite. Les numéros
 * qu'elles portent restent malgré tout réservés, pour qu'aucun doublon ne
 * puisse apparaître.
 */
const NEW_PREFIX = 'VI';
const PAD = 5;

/* Numéros émis pendant CETTE session mais pas encore visibles dans la liste des
 * commandes (le temps de l'enregistrement). Sans cela, deux créations
 * rapprochées recevraient le même numéro.
 *
 * Volontairement NON persisté : un compteur mémorisé ne redescend jamais, si
 * bien qu'une attribution erronée le gonfle définitivement. En repartant des
 * commandes réelles, la numérotation se corrige d'elle-même. */
let _issuedThisSession = [];
/* Dernier maximum observé. S'il RECULE, c'est que des numéros ont été corrigés :
   les réservations en cours deviennent caduques, sinon elles maintiendraient la
   série au-dessus de l'erreur qu'on vient justement de réparer. */
let _lastMaxUsed = 0;

function numOf(val) {
  const m = String(val || '').match(/^VI(\d+)$/i);
  return m ? parseInt(m[1], 10) : 0;
}

/** Tous les numéros VI en circulation — sert à ne jamais créer de doublon. */
function seriesNumsIn(orders) {
  const nums = new Set();
  for (const o of orders || []) {
    for (const val of [o.id, o.trackingNumber]) {
      const n = numOf(val);
      if (n) nums.add(n);
    }
  }
  return nums;
}

const A_CONFIRMER = new Set(A_CONFIRMER_STATUSES);

/** Plus grand numéro parmi les commandes « À Confirmer » — la seule référence. */
function seriesMaxIn(orders) {
  let max = 0;
  for (const o of orders || []) {
    if (!A_CONFIRMER.has(o?.status)) continue;
    for (const val of [o.id, o.trackingNumber]) {
      const n = numOf(val);
      if (n > max) max = n;
    }
  }
  return max;
}

/** Un code appartenant à l'une des séries de l'application (VI, VICT, VICTOURY). */
export function isVictCode(s) {
  return /^(VI|VICT|VICTOURY)\d+$/i.test(String(s || '').trim());
}

/** Format d'affichage d'un numéro de la série. */
export function formatVictId(n) {
  return NEW_PREFIX + String(n).padStart(PAD, '0');
}

/* Point de départ EXPLICITE de la série, réglable dans Réglages. */
const NEXT_KEY = 'victoury_next_number';

/** Prochain numéro réglé manuellement, ou 0 si aucun. */
export function readNextNumber() {
  const n = parseInt(localStorage.getItem(NEXT_KEY) || '0', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Définit le prochain numéro de la série (Réglages). */
export function setNextNumber(n) {
  const v = Math.max(1, parseInt(n, 10) || 1);
  try { localStorage.setItem(NEXT_KEY, String(v)); } catch { /* quota */ }
  cloudSet(NEXT_KEY, v);
  return v;
}

/** Numéro que recevra la prochaine commande, SANS le consommer.
 *  Sert à afficher l'état réel de la série dans Réglages. */
export function peekNextVictId(orders) {
  const used = seriesNumsIn(orders);
  const explicit = readNextNumber();
  let n = explicit || seriesMaxIn(orders) + 1;
  while (used.has(n)) n++;
  return formatVictId(n);
}

/** Numéro SUIVANT de la série. Part du point de départ réglé s'il existe, sinon
 *  du plus grand numéro « À Confirmer », et saute tout numéro déjà utilisé. */
export function generateVictId(orders) {
  const used = seriesNumsIn(orders);             // tous les numéros pris
  const seriesMax = seriesMaxIn(orders);         // où en est la série À Confirmer
  if (seriesMax < _lastMaxUsed) _issuedThisSession = [];
  _lastMaxUsed = seriesMax;
  // On ignore les réservations devenues visibles dans la liste : seules comptent
  // celles encore en attente d'enregistrement.
  _issuedThisSession = _issuedThisSession.filter(n => !used.has(n) && n > seriesMax);
  const maxPending = _issuedThisSession.length ? Math.max(..._issuedThisSession) : 0;
  const explicit = readNextNumber();
  let n = explicit || Math.max(seriesMax, maxPending) + 1;
  if (explicit && maxPending >= n) n = maxPending + 1;
  while (used.has(n) || _issuedThisSession.includes(n)) n++;
  _issuedThisSession.push(n);
  if (explicit) setNextNumber(n + 1);
  return formatVictId(n);
}
