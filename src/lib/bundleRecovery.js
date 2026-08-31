/* Réparation d'un bundle incohérent, par paliers.
 *
 * Après une mise en ligne, un appareil peut mélanger deux versions de
 * l'application : une page d'entrée gardée en cache réclame des fichiers d'une
 * version disparue. Le symptôme est une constante lue avant d'exister —
 * « Cannot access 'x' before initialization ».
 *
 * Vider les caches ne suffit pas toujours : le service worker se réinstalle
 * dans la foulée et ressert la version cassée. La réparation s'arrêtait pourtant
 * là et rendait la main à l'utilisateur, avec un bouton qui refaisait exactement
 * la tentative venant d'échouer — l'écran revenait sans fin.
 *
 * On monte donc d'un cran à chaque échec, et on ne s'arrête qu'une fois les
 * paliers épuisés : mieux vaut un écran honnête qu'un rechargement perpétuel.
 */
export const RECOVERY_KEY = '_recover_n';
export const RECOVERY_MAX = 2;

/* Deux erreurs rapprochées viennent du MÊME chargement — un module qui casse en
   lève souvent plusieurs. Les compter séparément épuiserait les paliers sans
   qu'aucune réparation n'ait eu le temps d'agir. */
export const RECOVERY_MIN_GAP_MS = 3000;

/** Palier suivant : 'caches', 'hard', ou null s'il n'y a plus rien à tenter. */
export function nextRecoveryStep(attempts, sinceLastMs) {
  if (!(attempts < RECOVERY_MAX)) return null;
  if (sinceLastMs < RECOVERY_MIN_GAP_MS) return null;
  return attempts === 0 ? 'caches' : 'hard';
}

/* Signes d'un bundle incohérent. Volontairement étroit : élargir à « is not a
   function » ferait recharger l'application sur de VRAIS bugs, qui
   disparaîtraient alors sans jamais être vus. */
export function isStaleBundleError(msg) {
  return /Loading chunk|dynamically imported module|module script failed|before initialization/i.test(String(msg || ''));
}
