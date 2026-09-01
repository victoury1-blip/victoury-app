/* Limiteur de débit minimal, en mémoire.
 *
 * Chaque instance serverless a sa propre mémoire — la limite est donc
 * approximative, pas exacte. C'est suffisant ici : le but est d'empêcher un
 * abus grossier de la route publique, pas de compter au visiteur près. */
const compteurs = new Map();

export function rateLimited(cle, max, fenetreMs) {
  const maintenant = Date.now();
  const entree = compteurs.get(cle);
  if (!entree || maintenant - entree.debut > fenetreMs) {
    compteurs.set(cle, { debut: maintenant, n: 1 });
    return false;
  }
  entree.n += 1;
  return entree.n > max;
}

export const clientIp = (req) =>
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'inconnu';
