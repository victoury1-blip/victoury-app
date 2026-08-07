import { cloudSet } from './cloudSettings';

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

/* Plus haut numéro DÉJÀ ÉMIS. La numérotation ne revient jamais en arrière :
 * un numéro libéré (commande supprimée, ou code remplacé par celui d'Ozon) n'est
 * pas redonné. Sans ce repère, une commande récente pouvait recevoir un petit
 * numéro devenu libre et se retrouver hors d'ordre par rapport à sa date.
 * Conservé localement ET dans le cloud pour que deux appareils n'émettent pas
 * le même numéro chacun de leur côté. */
const HIGH_WATER_KEY = 'victoury_seq_counter';

function readHighWater() {
  const n = parseInt(localStorage.getItem(HIGH_WATER_KEY) || '0', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function saveHighWater(n) {
  try { localStorage.setItem(HIGH_WATER_KEY, String(n)); } catch { /* quota */ }
  cloudSet(HIGH_WATER_KEY, n);
}

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

/** Numéro VICTOURY SUIVANT : toujours au-dessus de tout ce qui a déjà été émis.
 *  Les numéros se suivent donc dans l'ordre des commandes, et aucun n'est jamais
 *  réattribué — y compris après une suppression ou un alignement sur Ozon. */
export function generateVictId(orders) {
  const used = victouryNumsIn(orders);
  const maxUsed = used.size ? Math.max(...used) : 0;
  const n = Math.max(maxUsed, readHighWater()) + 1;
  saveHighWater(n);
  return NEW_PREFIX + String(n).padStart(4, '0');
}

/** Aligne le repère sur les commandes chargées (au démarrage). Ne le fait
 *  jamais redescendre : il ne peut que monter. */
export function initVictCounter(orders) {
  const used = victouryNumsIn(orders);
  const maxUsed = used.size ? Math.max(...used) : 0;
  if (maxUsed > readHighWater()) saveHighWater(maxUsed);
}
