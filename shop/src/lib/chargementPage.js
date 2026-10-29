import { lazy } from 'react';

/* Pages chargées à la demande (un fichier par page). Après une mise en ligne,
 * un onglet resté ouvert réclame les fichiers de l'ANCIENNE version, qui
 * n'existent plus : le clic sur le menu restait sans effet jusqu'à un
 * rafraîchissement à la main. Ici, un échec de chargement recharge la page
 * tout seul (l'adresse visée est déjà dans la barre, on y arrive directement),
 * au plus une fois toutes les 20 secondes pour ne jamais boucler.
 *
 * `precharger` permet de récupérer tous les fichiers de l'administration en
 * arrière-plan dès son ouverture : la navigation devient instantanée, comme
 * une application. */

const CLE = 'rechargement-apres-mise-a-jour';
const RE_CHUNK = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i;

export function estErreurDeChargement(erreur) {
  return RE_CHUNK.test(erreur?.message || String(erreur || ''));
}

/** Recharge la page si le dernier rechargement automatique date de plus de 20 s. */
export function rechargerSiPossible() {
  try {
    const dernier = Number(sessionStorage.getItem(CLE) || 0);
    if (Date.now() - dernier < 20_000) return false;
    sessionStorage.setItem(CLE, String(Date.now()));
  } catch { /* stockage indisponible : on recharge quand même une fois */ }
  window.location.reload();
  return true;
}

export function page(importer) {
  const Composant = lazy(() => importer().catch(erreur => {
    // La promesse ne se résout jamais pendant le rechargement : pas de flash d'erreur.
    if (estErreurDeChargement(erreur) && rechargerSiPossible()) return new Promise(() => {});
    throw erreur;
  }));
  Composant.precharger = () => importer().catch(() => {});
  return Composant;
}
