/* Proxy vers l'API officielle de Chic Affiliate (Clé API « CHIC_... » du
   profil affilié — celle utilisée par l'intégration urlanding).
   La clé est envoyée par le client dans l'en-tête x-chic-key.
   Paramètres :
   - path : chemin /api/... (obligatoire)
   - host : www.chic-affiliate.com (défaut) | api.chic-affiliate.com | chic-affiliate.com
   - auth : bearer (défaut) | xkey (X-API-KEY) | plain (Authorization brut) | query (?api_key=) */
const ALLOWED_HOSTS = ['www.chic-affiliate.com', 'api.chic-affiliate.com', 'chic-affiliate.com'];

export default async function handler(req, res) {
  const { path, host = 'www.chic-affiliate.com', auth = 'bearer' } = req.query;
  const key = req.headers['x-chic-key'];
  if (!path || !key) return res.status(400).json({ error: 'Missing path or key' });
  if (!/^\/api\//.test(path)) return res.status(400).json({ error: 'Chemin non autorisé' });
  if (!ALLOWED_HOSTS.includes(host)) return res.status(400).json({ error: 'Host non autorisé' });

  let url = `https://${host}${path}`;
  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };
  if (auth === 'xkey') headers['X-API-KEY'] = key;
  else if (auth === 'plain') headers['Authorization'] = key;
  else if (auth === 'query') url += (url.includes('?') ? '&' : '?') + `api_key=${encodeURIComponent(key)}`;
  else headers['Authorization'] = `Bearer ${key}`;

  try {
    const opts = { method: req.method === 'POST' ? 'POST' : 'GET', headers, redirect: 'manual' };
    if (req.method === 'POST') {
      headers['Content-Type'] = req.headers['content-type'] || 'application/json';
      opts.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    }
    const r = await fetch(url, opts);
    const text = await r.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 800) }; }
    return res.status(200).json({ status: r.status, redirected: r.status >= 300 && r.status < 400, location: r.headers.get('location') || undefined, body });
  } catch (e) {
    return res.status(200).json({ status: 0, error: e.message });
  }
}
