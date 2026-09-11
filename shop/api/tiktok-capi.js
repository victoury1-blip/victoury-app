// Relais vers l'Events API de TikTok — même rôle que meta-capi.js : le
// pixel du navigateur (ttq) peut être bloqué (ad blockers) ou planter à
// l'initialisation selon la page, et une part réelle des conversions
// n'atteint alors jamais TikTok. Ce relais renvoie les mêmes évènements
// depuis le serveur, avec le même event_id — TikTok déduplique.
//
// Route PUBLIQUE, comme meta-capi.js : le jeton d'accès n'est donc JAMAIS
// reçu du client, il vit uniquement dans TIKTOK_ACCESS_TOKEN (Vercel).
//
// Les données personnelles arrivent DÉJÀ hachées (SHA-256) — voir pixel.js.

import { rateLimited, clientIp } from './_rateLimit.js';

const API_VERSION = 'v1.3';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ configured: !!process.env.TIKTOK_ACCESS_TOKEN });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const token = process.env.TIKTOK_ACCESS_TOKEN;
  if (!token) return res.status(503).json({ error: "Jeton d'accès non configuré sur le serveur" });

  if (rateLimited(`ttcapi:${clientIp(req)}`, 30, 60000)) {
    return res.status(429).json({ error: 'Trop de requêtes — réessayez dans une minute' });
  }

  const { pixelId, events, testCode } = req.body || {};
  // L'identifiant TikTok est alphanumérique (ex. CVAG6PJC77U2KF3E3AV0) —
  // contrôler sa forme évite d'injecter une valeur arbitraire dans l'appel.
  if (!/^[A-Z0-9]{10,30}$/.test(String(pixelId || ''))) return res.status(400).json({ error: 'Pixel ID invalide' });
  if (!Array.isArray(events) || !events.length) return res.status(400).json({ error: 'Aucun évènement' });
  if (events.length > 50) return res.status(400).json({ error: "Trop d'évènements en un envoi" });

  /* Même garde-fou que meta-capi.js : refus des données NON hachées. */
  const estHash = (v) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
  for (const e of events) {
    const u = e?.user || {};
    for (const [k, v] of Object.entries(u)) {
      if (['ttclid', 'ttp', 'ip', 'user_agent'].includes(k)) continue;
      const vals = Array.isArray(v) ? v : [v];
      if (!vals.every(estHash)) return res.status(400).json({ error: `Donnée « ${k} » non hachée` });
    }
  }

  const url = `https://business-api.tiktok.com/open_api/${API_VERSION}/event/track/`;
  const body = { event_source: 'web', event_source_id: pixelId, data: events };
  if (testCode) body.test_event_code = String(testCode);

  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 9000);
  try {
    const r = await fetch(url, {
      method: 'POST', signal: ac.signal,
      headers: { 'Content-Type': 'application/json', 'Access-Token': token },
      body: JSON.stringify(body),
    });
    const texte = await r.text();
    let data;
    try { data = JSON.parse(texte); } catch { data = { raw: texte.slice(0, 400) }; }
    if (!r.ok || data?.code !== 0) {
      const msg = data?.message || `TikTok a répondu ${r.status}`;
      console.error('tiktok-capi:', r.status, msg);
      return res.status(502).json({ error: msg });
    }
    return res.status(200).json({ ok: true, requestId: data?.request_id });
  } catch (e) {
    const timeout = e?.name === 'AbortError';
    return res.status(504).json({ error: timeout ? "TikTok n'a pas répondu à temps" : `Envoi impossible : ${e?.message || 'erreur réseau'}` });
  } finally {
    clearTimeout(to);
  }
}
