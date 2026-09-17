// Limiteur de débit en mémoire, partagé par les endpoints coûteux.
//
// Best-effort : sur du serverless, chaque instance a sa propre mémoire, donc la
// limite réelle est un multiple du seuil. Cela suffit à empêcher une boucle
// emballée ou un jeton fuité de consommer sans fin — ce n'est pas une défense
// contre un attaquant distribué.
//
// (Fichier préfixé « _ » : importable mais non exposé comme route.)

const buckets = new Map();

/** Adresse de l'appelant, telle que vue derrière le proxy Vercel.
 *
 * `x-forwarded-for` peut contenir plusieurs adresses séparées par des virgules
 * — et son PREMIER élément est justement celui qu'un visiteur peut fabriquer
 * lui-même en l'envoyant dans sa propre requête : Vercel ne le remplace pas,
 * il AJOUTE la vraie IP à la fin de la liste. Faire confiance au premier
 * élément revient donc à faire confiance à ce que le visiteur prétend être —
 * exactement ce qui permettait de contourner un blocage par IP ou de fausser
 * la géolocalisation envoyée à la publicité. `x-real-ip`, lui, est posé par le
 * proxy de Vercel lui-même et ne peut pas être falsifié par le client. */
export function clientIp(req) {
  const realIp = req.headers['x-real-ip'];
  if (realIp) return String(realIp).trim();
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const parts = String(forwarded).split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Renvoie true si l'appelant DÉPASSE la limite (la requête doit être refusée).
 * @param {string} key      identifiant du seau (ex. `assistant:1.2.3.4`)
 * @param {number} max      requêtes autorisées par fenêtre
 * @param {number} windowMs durée de la fenêtre
 */
export function rateLimited(key, max = 15, windowMs = 60000) {
  const now = Date.now();
  // Purge des seaux expirés pour que la Map ne grossisse pas indéfiniment.
  if (buckets.size > 500) {
    for (const [k, v] of buckets) if (now - v.start > windowMs) buckets.delete(k);
  }
  const entry = buckets.get(key);
  if (!entry || now - entry.start > windowMs) {
    buckets.set(key, { start: now, count: 1 });
    return false;
  }
  entry.count++;
  return entry.count > max;
}
