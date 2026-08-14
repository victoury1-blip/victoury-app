import { isAuthenticated } from './_auth.js';

/* Hôtes autorisés. Chic et Bouait tournent sur le même logiciel : le proxy est
   le même, seul l'hôte change. La liste est FERMÉE — sans elle, l'endpoint
   relaierait vers n'importe quelle adresse (SSRF / relais ouvert). */
const ALLOWED_HOSTS = ['www.chic-affiliate.com', 'chic-affiliate.com', 'bouaitafaffiliate.com', 'www.bouaitafaffiliate.com'];
const DEFAULT_HOST = 'www.chic-affiliate.com';

export default async function handler(req, res) {
  // Authentification obligatoire : sans cela, l'endpoint est un relais ouvert
  // (n'importe qui peut faire transiter des requêtes par votre domaine).
  if (!(await isAuthenticated(req))) return res.status(401).json({ error: 'Non autorisé' });
  const { path, xsrf, session, mode, host = DEFAULT_HOST, names = 'laravel_session' } = req.query;
  if (!path || !session) {
    return res.status(400).json({ error: 'Missing path or session' });
  }

  // Empêche l'évasion vers un autre hôte (SSRF / open-proxy) : le chemin doit
  // commencer par un seul "/" suivi d'un caractère de chemin — pas de "//host",
  // "/@host", "/\host" ni URL absolue.
  if (!/^\/[A-Za-z0-9]/.test(path)) {
    return res.status(400).json({ error: 'Chemin invalide' });
  }

  if (!ALLOWED_HOSTS.includes(host)) return res.status(400).json({ error: 'Hôte non autorisé' });
  const origin = `https://${host}`;
  const url = `${origin}${path}`;

  try {
    const sess = decodeURIComponent(session);
    const xsrfDecoded = xsrf ? decodeURIComponent(xsrf) : '';
    /* Le cookie de session ne s'appelle pas partout `laravel_session` : Laravel
       le nomme d'après l'application. On envoie la valeur sous chacun des noms
       annoncés — un cookie inconnu est ignoré, un nom manquant fait échouer
       toute la session. Les noms sont filtrés : un cookie ne peut pas contenir
       de séparateur, sous peine d'injection dans l'en-tête. */
    const cookieNames = String(names).split(',')
      .map(n => n.trim()).filter(n => /^[A-Za-z0-9_.-]{1,64}$/.test(n));
    if (!cookieNames.length) cookieNames.push('laravel_session');
    const cookie = [
      ...cookieNames.map(n => `${n}=${sess}`),
      ...(xsrfDecoded ? [`XSRF-TOKEN=${xsrfDecoded}`] : []),
    ].join('; ');
    const headers = {
      'Cookie': cookie,
      'Accept': mode === 'html' ? 'text/html' : 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': `${origin}/affiliate/products`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    };
    if (xsrfDecoded) headers['X-XSRF-TOKEN'] = xsrfDecoded;

    const fetchOpts = { headers, redirect: 'manual' };

    if (req.method === 'POST') {
      fetchOpts.method = 'POST';
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      headers['Accept'] = 'text/html,application/json';
      headers['Origin'] = origin;
      const body = typeof req.body === 'string' ? req.body : new URLSearchParams(req.body).toString();
      fetchOpts.body = body;
    }

    const response = await fetch(url, fetchOpts);

    if (response.status === 302 || response.status === 301) {
      const location = response.headers.get('location') || '';
      if (location.includes('/login')) {
        return res.status(401).json({ error: `Session expirée — reconnectez-vous sur ${host}` });
      }
      return res.status(200).json({ success: true, redirect: location });
    }

    const text = await response.text();

    if (mode === 'html') {
      return res.status(200).json({ html: text });
    }

    try {
      res.status(response.status).json(JSON.parse(text));
    } catch {
      res.status(response.status).json({ error: 'Réponse non-JSON', body: text.slice(0, 500) });
    }
  } catch (e) {
    /* Un nom de domaine inexistant ou un site injoignable remontait en
       « Erreur 500 » sans plus d'explication — impossible de savoir s'il
       fallait corriger l'adresse ou attendre. */
    const cause = e?.cause?.code || e?.code || '';
    const unreachable = /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|ECONNRESET|UNABLE_TO_VERIFY/i.test(cause);
    res.status(502).json({
      error: unreachable
        ? `${host} injoignable (${cause}) — vérifiez l'adresse du site`
        : `Requête impossible : ${e?.message || 'erreur réseau'}`,
    });
  }
}
