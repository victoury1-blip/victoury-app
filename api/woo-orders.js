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
  // Borné : une valeur fournie par le client ne doit pas pouvoir demander des
  // centaines de commandes d'un coup à une boutique déjà lente.
  const nb = Math.min(100, Math.max(1, parseInt(perPage, 10) || 50));
  if (!siteUrl || !consumerKey || !consumerSecret) {
    return res.status(400).json({ error: 'Config WooCommerce manquante (URL / clés)' });
  }

  // Anti-SSRF : uniquement HTTPS et un hôte autorisé. Sans ce contrôle, l'URL
  // fournie par le client permettait d'atteindre des adresses internes.
  let base;
  try {
    const u = new URL(String(siteUrl));
    const allowed = String(process.env.WOO_ALLOWED_HOSTS || 'victoury-maroc.com,www.victoury-maroc.com')
      .split(',').map(h => h.trim().toLowerCase()).filter(Boolean);
    if (u.protocol !== 'https:' || !allowed.includes(u.hostname.toLowerCase())) {
      return res.status(400).json({ error: 'URL de boutique non autorisée' });
    }
    base = `${u.origin}${u.pathname.replace(/\/$/, '')}`.replace(/\/$/, '');
  } catch {
    return res.status(400).json({ error: 'URL de boutique invalide' });
  }
  const qs = new URLSearchParams({
    status,
    per_page: String(nb),
    // Les plus récentes d'abord : avec un `per_page` réduit (repli quand la
    // boutique est lente), ce sont les commandes qui comptent qu'on garde.
    orderby: 'date',
    order: 'desc',
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
  const TIMEOUT_MS = 9000;
  const to = setTimeout(() => ac.abort(), TIMEOUT_MS);
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
      // Ne pas relayer le corps distant (fuite d'informations) : statut seulement.
      console.error('woo-orders upstream:', r.status, text.slice(0, 250));
      return res.status(502).json({ error: `WooCommerce a répondu ${r.status}` });
    }
    let data;
    try { data = JSON.parse(text); } catch { return res.status(502).json({ error: 'Réponse WooCommerce invalide (pas du JSON) — REST API désactivée ?' }); }
    return res.status(200).json({ ok: true, orders: data });
  } catch (e) {
    const isTimeout = e?.name === 'AbortError';
    // Le délai annoncé est celui réellement appliqué : le message parlait de 25 s
    // alors que l'abandon survient à 9 s, ce qui rendait le diagnostic impossible.
    return res.status(504).json({
      error: isTimeout
        ? `La boutique n'a pas répondu en ${TIMEOUT_MS / 1000} s (${nb} commandes demandées)`
        : `Connexion impossible: ${e?.message || 'erreur réseau'}`,
      timeout: isTimeout,
      perPage: nb,
    });
  } finally {
    clearTimeout(to);
  }
}
