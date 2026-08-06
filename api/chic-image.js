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
    // Restreint le proxy d'images à chic-affiliate.com en HTTPS (évite un SSRF
    // vers un hôte arbitraire / des services internes).
    if (!/^https:\/\/(www\.)?chic-affiliate\.com\//i.test(imageUrl)) {
      return res.status(400).json({ error: 'Hôte non autorisé' });
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

    // Ne relayer QUE des images : renvoyer le type distant tel quel permettrait
    // de servir du HTML depuis NOTRE domaine (donc d'y exécuter du script).
    const contentType = response.headers.get('content-type') || '';
    if (!/^image\//i.test(contentType)) {
      return res.status(415).json({ error: 'Ressource non-image' });
    }
    const buffer = Buffer.from(await response.arrayBuffer());

    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(200).send(buffer);
  } catch (e) {
    // Pas de message interne renvoyé au client.
    console.error('chic-image:', e?.message || e);
    res.status(502).json({ error: 'Image indisponible' });
  }
}
