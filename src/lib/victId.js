import { COLIS_PIPELINE_SET } from '../data/colisPipeline';

/* ── Nouvelle série : VICTOURYxxxx ──────────────────────────────────────────
 * L'ancienne série VICTxxxx a accumulé un historique de doublons et de
 * numéros aberrants (incident de renumérotage) : chaque commande qui en
 * hérite doit rester scannable pour ne pas casser un envoi déjà remis à un
 * transporteur, mais on n'émet plus AUCUN nouveau numéro dans cette série.
 *
 * Toute commande NOUVELLE — qu'elle entre par l'onglet « Nouveau » ou soit
 * confirmée directement (import) — reçoit désormais un code VICTOURY, tiré
 * d'un compteur propre, totalement indépendant de l'ancien historique VICT
 * (préfixe différent = aucune collision possible avec l'ancienne série).
 */
const NEW_PREFIX = 'VICTOURY';

/* Numéros émis pendant CETTE session mais pas encore visibles dans la liste des
 * commandes (le temps de l'enregistrement). Sans cela, deux créations
 * rapprochées recevraient le même numéro.
 *
 * Volontairement NON persisté : un compteur mémorisé ne redescend jamais, si
 * bien qu'une attribution erronée le gonfle définitivement — c'est ce qui a fait
 * sauter la série à 0193 alors que les commandes étaient revenues à 0047. En
 * repartant des commandes réelles, la numérotation se corrige d'elle-même. */
let _issuedThisSession = [];
/* Dernier maximum observé. S'il RECULE, c'est que des numéros ont été corrigés
   (alignement sur Ozon, correction manuelle) : les réservations en cours
   deviennent caduques, sinon elles maintiendraient la série au-dessus de
   l'erreur qu'on vient justement de réparer. */
let _lastMaxUsed = 0;

function numOf(val) {
  const m = String(val || '').match(/^VICTOURY(\d+)$/i);
  return m ? parseInt(m[1], 10) : 0;
}

/** Tous les numéros VICTOURY en circulation — sert à ne jamais créer de doublon. */
function victouryNumsIn(orders) {
  const nums = new Set();
  for (const o of orders || []) {
    for (const val of [o.id, o.trackingNumber]) {
      const n = numOf(val);
      if (n) nums.add(n);
    }
  }
  return nums;
}

/* Une commande déjà remise au transporteur (Liste des Colis) porte souvent un
 * code hérité, parfois très au-dessus de la série en cours. La faire entrer dans
 * le calcul du prochain numéro projetait la série loin devant : une commande
 * suivant 0048 recevait 0146. Ces commandes sont donc exclues du CALCUL — mais
 * leurs numéros restent réservés, pour ne pas créer de doublon. */
function inColisList(o) {
  return COLIS_PIPELINE_SET.has(o?.status) || (!!o?.trackingNumber && !!o?.validated);
}

/** Plus grand numéro de la série EN COURS (hors Liste des Colis). */
function seriesMaxIn(orders) {
  let max = 0;
  for (const o of orders || []) {
    if (inColisList(o)) continue;
    for (const val of [o.id, o.trackingNumber]) {
      const n = numOf(val);
      if (n > max) max = n;
    }
  }
  return max;
}

/** Un code déjà valide (ancienne série VICT OU nouvelle série VICTOURY). */
export function isVictCode(s) {
  return /^VICT(OURY)?\d+$/i.test(String(s || '').trim());
}

/** Numéro VICTOURY SUIVANT : au-dessus du plus grand numéro RÉELLEMENT porté par
 *  une commande. Les numéros suivent donc l'ordre des commandes, et la série se
 *  recale automatiquement si des numéros erronés ont été corrigés. */
export function generateVictId(orders) {
  const used = victouryNumsIn(orders);          // tous les numéros pris
  const seriesMax = seriesMaxIn(orders);        // où en est la série visible
  if (seriesMax < _lastMaxUsed) _issuedThisSession = [];
  _lastMaxUsed = seriesMax;
  // On ignore les réservations devenues visibles dans la liste : seules comptent
  // celles encore en attente d'enregistrement.
  _issuedThisSession = _issuedThisSession.filter(n => !used.has(n) && n > seriesMax);
  const maxPending = _issuedThisSession.length ? Math.max(..._issuedThisSession) : 0;
  // On repart de la série en cours, en sautant tout numéro déjà utilisé ailleurs.
  let n = Math.max(seriesMax, maxPending) + 1;
  while (used.has(n) || _issuedThisSession.includes(n)) n++;
  _issuedThisSession.push(n);
  return NEW_PREFIX + String(n).padStart(4, '0');
}
