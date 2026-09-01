// Relais vers l'API de Conversions de Meta (Conversions API).
//
// Le pixel du navigateur (fbq) est bloqué par les bloqueurs de pub et par
// Safari : une part réelle des achats n'est alors jamais vue par la
// publicité. Ce relais renvoie les mêmes évènements depuis le serveur, avec
// le même identifiant — Meta déduplique et ne compte la vente qu'une fois.
//
// Route PUBLIQUE : un visiteur du site l'appelle sans être connecté, comme le
// pixel lui-même. Le jeton d'accès n'est donc JAMAIS reçu du client — il vit
// uniquement dans la variable d'environnement META_ACCESS_TOKEN, configurée
// sur ce projet Vercel et invisible du navigateur.
//
// Les données personnelles arrivent DÉJÀ hachées (SHA-256) : ni ce serveur ni
// Meta ne voient un numéro en clair.

import { rateLimited, clientIp } from './_rateLimit.js';

const GRAPH_VERSION = 'v21.0';

export default async function handler(req, res) {
  // Ping sans secret : dit seulement si le jeton est configuré, pour que
  // l'administration puisse afficher un statut sans jamais le révéler.
  if (req.method === 'GET') {
    return res.status(200).json({ configured: !!process.env.META_ACCESS_TOKEN });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return res.status(503).json({ error: "Jeton d'accès non configuré sur le serveur" });

  if (rateLimited(`capi:${clientIp(req)}`, 30, 60000)) {
    return res.status(429).json({ error: 'Trop de requêtes — réessayez dans une minute' });
  }

  const { pixelId, events, testCode } = req.body || {};
  // L'identifiant est un nombre : le contrôler évite d'injecter un chemin
  // arbitraire dans l'URL appelée.
  if (!/^\d{5,25}$/.test(String(pixelId || ''))) return res.status(400).json({ error: 'Pixel ID invalide' });
  if (!Array.isArray(events) || !events.length) return res.status(400).json({ error: 'Aucun évènement' });
  if (events.length > 50) return res.status(400).json({ error: "Trop d'évènements en un envoi" });

  /* Refus des données NON hachées : un numéro en clair partirait tel quel
     chez Meta si ce garde-fou n'existait pas. */
  const estHash = (v) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
  for (const e of events) {
    const ud = e?.user_data || {};
    for (const [k, v] of Object.entries(ud)) {
      if (['client_ip_address', 'client_user_agent', 'fbp', 'fbc'].includes(k)) continue;
      const vals = Array.isArray(v) ? v : [v];
      if (!vals.every(estHash)) return res.status(400).json({ error: `Donnée « ${k} » non hachée` });
    }
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events`;
  const body = { data: events, access_token: token };
  if (testCode) body.test_event_code = String(testCode);

  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 9000);
  try {
    const r = await fetch(url, {
      method: 'POST', signal: ac.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const texte = await r.text();
    let data;
    try { data = JSON.parse(texte); } catch { data = { raw: texte.slice(0, 400) }; }
    if (!r.ok) {
      const msg = data?.error?.message || `Meta a répondu ${r.status}`;
      console.error('meta-capi:', r.status, msg);
      return res.status(502).json({ error: msg, code: data?.error?.code });
    }
    return res.status(200).json({ ok: true, received: data?.events_received ?? events.length, fbtrace_id: data?.fbtrace_id });
  } catch (e) {
    const timeout = e?.name === 'AbortError';
    return res.status(504).json({ error: timeout ? "Meta n'a pas répondu à temps" : `Envoi impossible : ${e?.message || 'erreur réseau'}` });
  } finally {
    clearTimeout(to);
  }
}
