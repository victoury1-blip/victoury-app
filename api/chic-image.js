export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Missing url' });
  }

  try {
    let imageUrl = url;
    try { imageUrl = decodeURIComponent(imageUrl); } catch {}
    if (imageUrl.includes('%2F') || imageUrl.includes('%3A')) {
      try { imageUrl = decodeURIComponent(imageUrl); } catch {}
    }
    if (!imageUrl.startsWith('http')) {
      return res.status(400).json({ error: 'A valid URL was not provided.' });
    }
    const response = await fetch(imageUrl, {
      headers: {
        'Referer': 'https://www.chic-affiliate.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return res.status(response.status).end();
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await response.arrayBuffer());

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(200).send(buffer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
