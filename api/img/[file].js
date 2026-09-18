/* Proxy d'images Chic Affiliate avec extension dans le chemin
   (/api/img/<base64url>.jpg) : WordPress/WooCommerce refuse de télécharger
   une URL sans extension, et chic-affiliate.com exige un Referer.

   Volontairement SANS authentification : cette route est appelée comme
   src d'une balise <img> sur un site WooCommerce tiers — un navigateur ne
   peut pas y joindre d'en-tête Authorization. Elle reste protégée par
   l'allowlist d'hôte ci-dessous, une limite de débit (repli si l'appel se
   fait trop nombreux), et — comme chic-image.js — en ne relayant que ce
   qui est vraiment une image, jamais le type de contenu renvoyé tel quel. */
import { rateLimited, clientIp } from './_rateLimit.js';

export default async function handler(req, res) {
  if (rateLimited(`img:${clientIp(req)}`, 120, 60000)) {
    return res.status(429).json({ error: 'Trop de requêtes' });
  }

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

    // Ne relayer QUE des images : renvoyer le type distant tel quel
    // permettrait de servir du HTML (donc du script) depuis notre domaine
    // si chic-affiliate.com était un jour compromis.
    const contentType = response.headers.get('content-type') || '';
    if (!/^image\//i.test(contentType)) {
      return res.status(415).json({ error: 'Ressource non-image' });
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(200).send(buffer);
  } catch (e) {
    console.error('img proxy:', e?.message || e);
    res.status(502).json({ error: 'Image indisponible' });
  }
}
