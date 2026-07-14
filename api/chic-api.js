/* Proxy vers l'API officielle de Chic Affiliate (Clé API « CHIC_... » du
   profil affilié — celle utilisée par l'intégration urlanding).
   La clé est envoyée par le client dans l'en-tête x-chic-key et transmise
   en Authorization: Bearer. Seuls les chemins /api/* sont autorisés. */
export default async function handler(req, res) {
  const { path } = req.query;
  const key = req.headers['x-chic-key'];
  if (!path || !key) return res.status(400).json({ error: 'Missing path or key' });
  if (!/^\/api\//.test(path)) return res.status(400).json({ error: 'Chemin non autorisé' });

  const url = `https://www.chic-affiliate.com${path}`;
  try {
    const opts = {
      method: req.method === 'POST' ? 'POST' : 'GET',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      redirect: 'manual',
    };
    if (req.method === 'POST') {
      opts.headers['Content-Type'] = req.headers['content-type'] || 'application/json';
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
