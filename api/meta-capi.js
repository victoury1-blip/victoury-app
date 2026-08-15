// Relais vers l'API de conversions de Meta (Conversions API).
//
// Meta n'apprend, depuis le site, que les commandes PASSÉES. En paiement à la
// livraison, une bonne part d'entre elles est ensuite annulée, injoignable ou
// refusée : l'algorithme optimise donc sur des ventes qui n'ont jamais eu lieu.
// Cette route renvoie à Meta ce que le système sait vraiment — livrée, annulée —
// pour qu'il cherche des acheteurs qui paient, et non des formulaires remplis.
//
// Les données personnelles arrivent DÉJÀ hachées (SHA-256) : ni ce serveur ni
// Meta ne voient un numéro en clair.
//
// Sécurité : appelant authentifié (jeton Supabase) + limite de débit.

import { isAuthenticated } from './_auth.js';
import { rateLimited, clientIp } from './_rateLimit.js';

const GRAPH_VERSION = 'v21.0';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });
  if (!(await isAuthenticated(req))) return res.status(401).json({ error: 'Non autorisé' });
  if (rateLimited(`capi:${clientIp(req)}`, 60, 60000)) {
    return res.status(429).json({ error: 'Trop de requêtes — réessayez dans une minute' });
  }

  const { pixelId, token, events, testCode } = req.body || {};
  // L'identifiant est un nombre : le contrôler évite d'injecter un chemin
  // arbitraire dans l'URL appelée.
  if (!/^\d{5,25}$/.test(String(pixelId || ''))) return res.status(400).json({ error: 'Pixel ID invalide' });
  if (!token || String(token).length < 20) return res.status(400).json({ error: 'Jeton d’accès manquant' });
  if (!Array.isArray(events) || !events.length) return res.status(400).json({ error: 'Aucun évènement' });
  // Meta accepte 1000 évènements par appel ; on reste loin de la limite.
  if (events.length > 200) return res.status(400).json({ error: 'Trop d’évènements en un envoi' });

  /* Refus des données NON hachées : un numéro en clair partirait tel quel chez
     Meta. Les champs d'identification doivent être des empreintes SHA-256. */
  const isHash = (v) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
  for (const e of events) {
    const ud = e?.user_data || {};
    for (const [k, v] of Object.entries(ud)) {
      if (k === 'client_ip_address' || k === 'client_user_agent' || k === 'fbp' || k === 'fbc') continue;
      const vals = Array.isArray(v) ? v : [v];
      if (!vals.every(isHash)) return res.status(400).json({ error: `Donnée « ${k} » non hachée` });
    }
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events`;
  const body = { data: events, access_token: token };
  if (testCode) body.test_event_code = String(testCode);

  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 9000);
  try {
    const r = await fetch(url, {
      method: 'POST',
      signal: ac.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 400) }; }
    if (!r.ok) {
      // Le message de Meta est repris tel quel : il nomme le champ fautif, ce
      // qu'un simple code HTTP ne dirait pas.
      const msg = data?.error?.message || `Meta a répondu ${r.status}`;
      console.error('meta-capi:', r.status, msg);
      return res.status(502).json({ error: msg, code: data?.error?.code });
    }
    return res.status(200).json({ ok: true, received: data?.events_received ?? events.length, fbtrace_id: data?.fbtrace_id });
  } catch (e) {
    const isTimeout = e?.name === 'AbortError';
    return res.status(504).json({ error: isTimeout ? 'Meta n’a pas répondu à temps' : `Envoi impossible : ${e?.message || 'erreur réseau'}` });
  } finally {
    clearTimeout(to);
  }
}
