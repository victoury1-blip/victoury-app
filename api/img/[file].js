/* Proxy d'images Chic Affiliate avec extension dans le chemin
   (/api/img/<base64url>.jpg) : WordPress/WooCommerce refuse de télécharger
   une URL sans extension, et chic-affiliate.com exige un Referer. */
export default async function handler(req, res) {
  const { file } = req.query;
  if (!file) return res.status(400).json({ error: 'Missing file' });

  const b64 = String(file).replace(/\.[a-z0-9]+$/i, '');
  let url;
  try {
    url = Buffer.from(b64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  } catch {
    return res.status(400).json({ error: 'Nom invalide' });
  }

  if (!/^https:\/\/(www\.)?chic-affiliate\.com\//i.test(url)) {
    return res.status(400).json({ error: 'URL non autorisée' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'Referer': 'https://www.chic-affiliate.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    if (!response.ok) return res.status(response.status).end();

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(200).send(buffer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
