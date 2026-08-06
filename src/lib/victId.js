import { cloudGet, cloudSet } from './cloudSettings';

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

/* Numéros VICTOURY déjà en circulation, connus de CETTE session (toutes
 * commandes rencontrées, même après suppression) : sert uniquement à éviter
 * qu'un numéro tout juste généré ne soit reproposé avant que la commande soit
 * enregistrée en base. Ce n'est PAS un plancher — contrairement à l'ancienne
 * série, un numéro libéré par une suppression est réutilisé. */
let _seenThisSession = new Set();

function victouryNumsIn(orders) {
  const nums = new Set();
  for (const o of orders || []) {
    for (const val of [o.id, o.trackingNumber]) {
      const m = String(val || '').match(/^VICTOURY(\d+)$/i);
      if (m) nums.add(parseInt(m[1], 10));
    }
  }
  return nums;
}

/** Un code déjà valide (ancienne série VICT OU nouvelle série VICTOURY). */
export function isVictCode(s) {
  return /^VICT(OURY)?\d+$/i.test(String(s || '').trim());
}

/** Compat : plus de compteur à initialiser, la numérotation se déduit des
 *  commandes actives à chaque génération (voir generateVictId). Conservé
 *  pour ne pas casser les appels existants. */
export function initVictCounter() {}

/** Compat : ne fait plus rien (la numérotation n'a plus de compteur figé),
 *  conservé pour ne pas casser les appels existants. */
export function recalcVictCounter() {}

/** Numéro VICTOURY libre le plus petit parmi les commandes ACTIVES fournies.
 *  Une commande supprimée n'apparaît plus dans `orders` -> son numéro est
 *  automatiquement réutilisé par la prochaine commande créée. */
export function generateVictId(orders) {
  const used = victouryNumsIn(orders);
  let n = 1;
  while (used.has(n) || _seenThisSession.has(n)) n++;
  _seenThisSession.add(n);
  return NEW_PREFIX + String(n).padStart(4, '0');
}

/* ── Ancienne série : conservée pour les commandes déjà numérotées ──────────
 * Utilisée uniquement par les outils de réparation (Réglages → Restaurer les
 * codes / Corriger les doublons) qui réconcilient l'historique avec Ozon.
 * Plus aucun nouveau code n'est émis dans cette série. */
export const VICT_ABERRANT_FROM = 1000;
