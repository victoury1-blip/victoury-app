export default async function handler(req, res) {
  const { path, xsrf, session, mode } = req.query;
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
      'Accept': mode === 'html' ? 'text/html' : 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': 'https://www.chic-affiliate.com/affiliate/products',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    };
    if (xsrfDecoded) headers['X-XSRF-TOKEN'] = xsrfDecoded;

    const fetchOpts = { headers, redirect: 'manual' };

    if (req.method === 'POST') {
      fetchOpts.method = 'POST';
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      headers['Accept'] = 'text/html,application/json';
      headers['Origin'] = 'https://www.chic-affiliate.com';
      const body = typeof req.body === 'string' ? req.body : new URLSearchParams(req.body).toString();
      fetchOpts.body = body;
    }

    const response = await fetch(url, fetchOpts);

    if (response.status === 302 || response.status === 301) {
      const location = response.headers.get('location') || '';
      if (location.includes('/login')) {
        return res.status(401).json({ error: 'Session expirée — reconnectez-vous sur chic-affiliate.com' });
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
    res.status(500).json({ error: e.message });
  }
}
