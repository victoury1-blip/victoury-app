export default async function handler(req, res) {
  const { path, xsrf, session } = req.query;
  if (!path || !session) {
    return res.status(400).json({ error: 'Missing path or session' });
  }

  const url = `https://www.chic-affiliate.com${path}`;

  try {
    const sess = decodeURIComponent(session);
    const xsrfDecoded = xsrf ? decodeURIComponent(xsrf) : '';
    const cookie = `laravel_session=${sess}${xsrfDecoded ? `; XSRF-TOKEN=${xsrfDecoded}` : ''}`;
    const headers = {
      'Cookie': cookie,
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': 'https://www.chic-affiliate.com/affiliate/orders',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    };
    if (xsrfDecoded) headers['X-XSRF-TOKEN'] = xsrfDecoded;

    const response = await fetch(url, { headers, redirect: 'manual' });

    if (response.status === 302 || response.status === 301) {
      return res.status(401).json({ error: 'Session expirée — reconnectez-vous sur chic-affiliate.com' });
    }

    const text = await response.text();
    try {
      res.status(response.status).json(JSON.parse(text));
    } catch {
      res.status(response.status).json({ error: 'Réponse non-JSON', body: text.slice(0, 500) });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
