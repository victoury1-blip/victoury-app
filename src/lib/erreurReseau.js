/* Une écriture échoue pour deux raisons très différentes :
 *  - le RÉSEAU (connexion coupée ou trop faible, alors que le téléphone se croit
 *    encore « en ligne ») → la commande doit être gardée et renvoyée plus tard ;
 *  - la BASE a refusé (droits, contrainte…) → renvoyer ne servirait à rien.
 * Supabase ne lève pas d'exception sur une coupure : il renvoie une erreur
 * sans code SQL, avec un message du navigateur (« Failed to fetch »,
 * « Load failed », « NetworkError… »). */
export function estErreurReseau(err, enLigne = typeof navigator === 'undefined' ? true : navigator.onLine) {
  if (!enLigne) return true;
  if (!err) return false;
  const msg = String(err.message || err.details || err || '');
  if (/failed to fetch|load failed|network ?error|networkerror|network request failed|fetch failed|timed? ?out|timeout|aborted|err_internet|err_network|connection/i.test(msg)) return true;
  // Une erreur de la base porte un code SQL/PostgREST (42501, 23505, PGRST…).
  return !err.code && !err.status && err.name === 'TypeError';
}
