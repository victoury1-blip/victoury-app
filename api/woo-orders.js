// Récupère les commandes WooCommerce côté SERVEUR (Vercel), au lieu du
// navigateur → rewrite → boutique. Plus fiable : User-Agent propre, pas de CORS,
// messages d'erreur clairs, timeout maîtrisé. Le client envoie sa config WC.
//
// Sécurité : appelant authentifié (session Supabase) — vérifié via _auth.

import { isAuthenticated } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });
  if (!(await isAuthenticated(req))) return res.status(401).json({ error: 'Non autorisé' });

  const { siteUrl, consumerKey, consumerSecret, status = 'processing,pending', perPage = 50 } = req.body || {};
  if (!siteUrl || !consumerKey || !consumerSecret) {
    return res.status(400).json({ error: 'Config WooCommerce manquante (URL / clés)' });
  }

  const base = String(siteUrl).replace(/\/$/, '');
  const qs = new URLSearchParams({
    status,
    per_page: String(perPage),
    // _fields : ne demander que le nécessaire -> réponse bien plus légère et
    // rapide (évite le timeout, surtout sur Vercel Hobby limité à 10s).
    _fields: 'id,number,status,date_created,date_modified,total,billing,line_items,customer_note',
    consumer_key: consumerKey,
    consumer_secret: consumerSecret,
  });
  const url = `${base}/wp-json/wc/v3/orders?${qs.toString()}`;

  const ac = new AbortController();
  // < 10s : rester sous la limite Vercel Hobby pour renvoyer une erreur propre
  // plutôt que d'être tué par la plateforme.
  const to = setTimeout(() => ac.abort(), 9000);
  try {
    const r = await fetch(url, {
      signal: ac.signal,
      headers: {
        // Certaines protections (Wordfence, hébergeur) bloquent les requêtes
        // sans User-Agent « navigateur » ; on en met un.
        'User-Agent': 'Mozilla/5.0 (compatible; VictouryApp/1.0)',
        Accept: 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64'),
      },
    });
    const text = await r.text();
    if (!r.ok) {
      return res.status(502).json({ error: `WooCommerce ${r.status}: ${text.slice(0, 250)}` });
    }
    let data;
    try { data = JSON.parse(text); } catch { return res.status(502).json({ error: 'Réponse WooCommerce invalide (pas du JSON) — REST API désactivée ?' }); }
    return res.status(200).json({ ok: true, orders: data });
  } catch (e) {
    const isTimeout = e?.name === 'AbortError';
    return res.status(504).json({ error: isTimeout ? 'Serveur WooCommerce trop lent (timeout 25s)' : `Connexion impossible: ${e?.message || 'erreur réseau'}` });
  } finally {
    clearTimeout(to);
  }
}
