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
let _victouryCounter = null;

function maxVictouryIn(orders) {
  let max = 0;
  for (const o of orders || []) {
    for (const val of [o.id, o.trackingNumber]) {
      const m = String(val || '').match(/^VICTOURY(\d+)$/i);
      if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
    }
  }
  return max;
}

/** Un code déjà valide (ancienne série VICT OU nouvelle série VICTOURY). */
export function isVictCode(s) {
  return /^VICT(OURY)?\d+$/i.test(String(s || '').trim());
}

/** Initialise le compteur VICTOURY = plus grand numéro VICTOURY déjà présent. */
export function initVictCounter(orders) {
  if (_victouryCounter !== null) return;
  _victouryCounter = maxVictouryIn(orders);
  localStorage.setItem('victoury_seq_counter', String(_victouryCounter));
  cloudSet('victoury_seq_counter', _victouryCounter);
}

/** Recalage : ne descend jamais sous ce qui a déjà été généré cette session. */
export function recalcVictCounter(orders) {
  _victouryCounter = Math.max(maxVictouryIn(orders), _victouryCounter || 0);
  localStorage.setItem('victoury_seq_counter', String(_victouryCounter));
  cloudSet('victoury_seq_counter', _victouryCounter);
}

export function generateVictId() {
  _victouryCounter = (_victouryCounter || 0) + 1;
  localStorage.setItem('victoury_seq_counter', String(_victouryCounter));
  cloudSet('victoury_seq_counter', _victouryCounter);
  return NEW_PREFIX + String(_victouryCounter).padStart(4, '0');
}

/* ── Ancienne série : conservée pour les commandes déjà numérotées ──────────
 * Utilisée uniquement par les outils de réparation (Réglages → Restaurer les
 * codes / Corriger les doublons) qui réconcilient l'historique avec Ozon.
 * Plus aucun nouveau code n'est émis dans cette série. */
export const VICT_ABERRANT_FROM = 1000;
