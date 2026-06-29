export default async function handler(req, res) {
  const { path, xsrf, session } = req.query;
  if (!path || !session) {
    return res.status(400).json({ error: 'Missing path or session' });
  }

  const url = `https://www.chic-affiliate.com${path}`;

  try {
    const cookie = `laravel_session=${session}${xsrf ? `; XSRF-TOKEN=${xsrf}` : ''}`;
    const headers = {
      'Cookie': cookie,
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': 'https://www.chic-affiliate.com/affiliate/orders',
    };
    if (xsrf) headers['X-XSRF-TOKEN'] = decodeURIComponent(xsrf);

    const response = await fetch(url, { headers });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
