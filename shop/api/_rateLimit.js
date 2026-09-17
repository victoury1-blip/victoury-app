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

/* `x-forwarded-for` peut contenir plusieurs adresses séparées par des
 * virgules — et la PREMIÈRE est justement celle qu'un visiteur peut fabriquer
 * lui-même en l'envoyant dans sa requête : Vercel ne la remplace pas, il
 * AJOUTE la vraie IP à la fin de la liste. S'y fier revenait à faire
 * confiance à ce que le visiteur prétend être — une IP bloquée pouvait ainsi
 * se faire passer pour une autre. `x-real-ip` est posé par le proxy de
 * Vercel lui-même et ne peut pas être falsifié par le client. */
export const clientIp = (req) => {
  const realIp = req.headers['x-real-ip'];
  if (realIp) return String(realIp).trim();
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const parts = String(forwarded).split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return req.socket?.remoteAddress || 'inconnu';
};
