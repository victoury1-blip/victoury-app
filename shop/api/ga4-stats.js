// Lecture des statistiques de fréquentation (Google Analytics 4) pour le
// Tableau de bord de l'administration — Sessions et Ajouts au panier.
//
// Le Measurement ID (G-XXXXXXXXXX, voir GoogleAnalytics.jsx) ne sert qu'au
// script du NAVIGATEUR, qui écrit chez Google : il ne permet pas de relire
// les chiffres depuis un serveur. Lire demande un compte de service Google
// Cloud, autorisé sur la propriété GA4 — d'où les trois variables ci-dessous.
//
// Variables d'environnement requises (Vercel → Settings → Environment
// Variables, projet DE LA BOUTIQUE) :
//   GA4_PROPERTY_ID       identifiant numérique de la propriété GA4 (PAS le
//                          Measurement ID — Administration → Détails de la
//                          propriété, en haut)
//   GA4_CLIENT_EMAIL       e-mail du compte de service (se termine par
//                          .iam.gserviceaccount.com)
//   GA4_PRIVATE_KEY        clé privée du compte de service (bloc
//                          "-----BEGIN PRIVATE KEY-----…", avec ses \n)
//
// Le compte de service doit être ajouté comme utilisateur (Lecteur suffit)
// de la propriété GA4 : Administration → Gestion des accès à la propriété.

import { createSign } from 'crypto';
import { isAuthenticated } from './_auth.js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';

/** Jeton d'accès OAuth2 pour le compte de service, via un JWT auto-signé
 *  (RFC 7523) — évite une dépendance supplémentaire (googleapis/jsonwebtoken)
 *  pour un unique échange de jeton. */
async function obtenirJetonAcces(email, clePrivee) {
  const maintenant = Math.floor(Date.now() / 1000);
  const entete = { alg: 'RS256', typ: 'JWT' };
  const corps = {
    iss: email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: maintenant,
    exp: maintenant + 3600,
  };
  const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const aSigner = `${b64url(entete)}.${b64url(corps)}`;
  const signature = createSign('RSA-SHA256').update(aSigner).sign(clePrivee, 'base64url');
  const jwt = `${aSigner}.${signature}`;

  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await r.json();
  if (!r.ok || !data.access_token) throw new Error(data.error_description || data.error || 'Jeton Google refusé');
  return data.access_token;
}

async function runReport(propertyId, accessToken, body) {
  const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || `Google Analytics a répondu ${r.status}`);
  return data;
}

function premiereValeur(rapport, index = 0) {
  const v = rapport?.rows?.[0]?.metricValues?.[index]?.value;
  return v != null ? Number(v) || 0 : 0;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });
  if (!(await isAuthenticated(req))) return res.status(401).json({ error: 'Non autorisé' });

  const propertyId = String(process.env.GA4_PROPERTY_ID || '').trim();
  const email = String(process.env.GA4_CLIENT_EMAIL || '').trim();
  // Vercel échappe les retours à la ligne d'une variable multiligne : on les
  // restaure, sinon la clé PEM est illisible pour `crypto`.
  const clePrivee = String(process.env.GA4_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
  if (!propertyId || !email || !clePrivee) {
    return res.status(200).json({ configured: false });
  }

  const { startDate, endDate } = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate || '') || !/^\d{4}-\d{2}-\d{2}$/.test(endDate || '')) {
    return res.status(400).json({ error: 'Dates invalides (AAAA-MM-JJ attendu)' });
  }

  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 9000);
  try {
    const accessToken = await obtenirJetonAcces(email, clePrivee);
    const dateRanges = [{ startDate, endDate }];

    const [trafic, panier] = await Promise.all([
      runReport(propertyId, accessToken, { dateRanges, metrics: [{ name: 'sessions' }, { name: 'totalUsers' }] }),
      runReport(propertyId, accessToken, {
        dateRanges,
        metrics: [{ name: 'eventCount' }],
        dimensions: [{ name: 'eventName' }],
        dimensionFilter: { filter: { fieldName: 'eventName', stringFilter: { value: 'add_to_cart' } } },
      }),
    ]);

    return res.status(200).json({
      configured: true,
      sessions: premiereValeur(trafic, 0),
      totalUsers: premiereValeur(trafic, 1),
      ajoutsPanier: premiereValeur(panier, 0),
    });
  } catch (e) {
    const isTimeout = e?.name === 'AbortError';
    console.error('ga4-stats:', e?.message);
    return res.status(502).json({ error: isTimeout ? "Google Analytics n'a pas répondu à temps" : (e?.message || 'Erreur Google Analytics') });
  } finally {
    clearTimeout(to);
  }
}
