// Récupère le STATUT réel d'un colis depuis le tableau de bord Ozon (client.ozoneexpress.ma),
// via l'endpoint DataTables `parcels_json`, en cherchant par code d'envoi ou par téléphone.
// Renvoie uniquement { found, status } — pas de HTML tiers brut.

import { isAuthenticated } from './_auth.js';

const rateLimitMap = new Map();
function rateLimit(ip, maxRequests = 15, windowMs = 60000) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.start > windowMs) { rateLimitMap.set(ip, { start: now, count: 1 }); return false; }
  entry.count++;
  return entry.count > maxRequests;
}

// Libellés de statut Ozon, du plus « final » au moins prioritaire.
const STATUS_KEYWORDS = [
  'Livré', 'Livrée', 'Retourné', 'Retournée', 'Refusé', 'Refusée',
  'En cours de distribution', 'Mise en distribution', 'Reçu au hub', 'Reçu',
  'Expédié', 'Ramassé', 'En attente de ramassage', 'Nouveau colis',
];
// Codes internes Ozon (parcel_status) → libellé lisible.
const STATUS_CODE_MAP = [
  [/deliver|livr/i, 'Livré'],
  [/return|retour/i, 'Retourné'],
  [/refus|reject/i, 'Refusé'],
  [/distribut|out.?for/i, 'En cours de distribution'],
  [/hub|received|recu|reçu/i, 'Reçu'],
  [/dispatch|expedi|shipped/i, 'Expédié'],
  [/pickup|ramass/i, 'Ramassé'],
  [/new.?parcel|nouveau/i, 'Nouveau colis'],
];

function pickStatus(text) {
  if (!text) return '';
  const low = String(text).toLowerCase();
  for (const kw of STATUS_KEYWORDS) if (low.includes(kw.toLowerCase())) return kw;
  for (const [re, label] of STATUS_CODE_MAP) if (re.test(text)) return label;
  return '';
}

const DT_COLUMNS = [
  'PARCEL_CODE', 'PARCEL_RECEIVER', 'PARCEL_PRODUCTS', 'PARCEL_COMMENT', 'PARCEL_PICKUP_TIME',
  'PARCEL_STATUT', 'PARCEL_CITY', 'PARCEL_PRICE', 'PARCEL_ACTION', 'PARCEL_NOTES',
];
const DT_NON_ORDERABLE = new Set([4, 8, 9]);

function fmtTime(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default async function handler(req, res) {
  if (!(await isAuthenticated(req))) return res.status(401).json({ error: 'Non autorisé' });

  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (rateLimit(clientIp)) return res.status(429).json({ error: 'Trop de requêtes. Réessayez dans une minute.' });

  // Recherche unique (?code= / ?phone=) OU lot (?codes=A,B,C — jusqu'à 40).
  // Le lot ne se connecte qu'UNE fois à Ozon puis interroge chaque valeur.
  const batchRaw = (req.query.codes || '').toString().trim();
  const queries = batchRaw
    ? batchRaw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 40)
    : [(req.query.code || req.query.phone || '').toString().trim()].filter(Boolean);
  if (!queries.length) return res.status(400).json({ error: 'code, phone or codes required' });
  if (queries.some(q => !/^[A-Za-z0-9]{3,30}$/.test(q))) return res.status(400).json({ error: 'Format invalide' });

  const EMAIL = process.env.OZONE_EMAIL;
  const PASS = process.env.OZONE_PASS;
  if (!EMAIL || !PASS) return res.status(500).json({ error: 'Ozone credentials not configured' });

  const BASE = 'https://client.ozoneexpress.ma';
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  function extractCookies(response) {
    const all = [];
    response.headers.forEach((val, key) => {
      if (key.toLowerCase() === 'set-cookie') {
        val.split(/,(?=[^ ])/).forEach(c => { const name = c.split(';')[0].trim(); if (name) all.push(name); });
      }
    });
    return all;
  }
  function mergeCookies(...arrays) {
    const map = new Map();
    for (const arr of arrays) for (const c of arr) { const i = c.indexOf('='); if (i > 0) map.set(c.substring(0, i), c); }
    return [...map.values()];
  }

  try {
    // 1) Login (même flux que ozone-check)
    const loginPage = await fetch(`${BASE}/login`, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
      redirect: 'follow',
    });
    const loginHtml = await loginPage.text();
    const cookies1 = extractCookies(loginPage);

    const allInputs = [];
    const inputPattern = /<input[^>]*>/gi;
    let im;
    while ((im = inputPattern.exec(loginHtml)) !== null) {
      const nameM = im[0].match(/name=["']([^"']+)["']/);
      const typeM = im[0].match(/type=["']([^"']+)["']/);
      const valM = im[0].match(/value=["']([^"']*?)["']/);
      if (nameM) allInputs.push({ name: nameM[1], type: typeM ? typeM[1] : 'text', value: valM ? valM[1] : '' });
    }
    const body1 = new URLSearchParams();
    body1.append('login_customers_email', EMAIL);
    body1.append('login_customers_password', PASS);
    body1.append('remember', 'on');
    for (const inp of allInputs) {
      if (inp.type === 'hidden' && inp.name !== 'email' && inp.name !== 'password') body1.append(inp.name, inp.value);
    }
    const loginRes1 = await fetch(`${BASE}/login?action=login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA, 'Cookie': cookies1.join('; '),
        'Referer': `${BASE}/login`, 'Origin': BASE, 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json, text/html, */*',
      },
      body: body1.toString(), redirect: 'manual',
    });
    await loginRes1.text();
    let allCookies = mergeCookies(cookies1, extractCookies(loginRes1));
    const redir = loginRes1.headers.get('location');
    if (redir) {
      const redirUrl = redir.startsWith('http') ? redir : `${BASE}${redir.startsWith('/') ? '' : '/'}${redir}`;
      const redirRes = await fetch(redirUrl, { headers: { 'User-Agent': UA, 'Cookie': allCookies.join('; ') }, redirect: 'manual' });
      allCookies = mergeCookies(allCookies, extractCookies(redirRes));
    }

    // 2) Interroger le DataTables parcels_json (POST) avec le contrat complet observé :
    //    colonnes, filtres et plage de dates obligatoire sur parcel_last_update.
    const fEnd = new Date(Date.now() + 2 * 86400000);   // +2 jours
    const fStart = new Date(Date.now() - 730 * 86400000); // -2 ans (large)
    async function queryParcels(query) {
      const params = new URLSearchParams();
      params.append('draw', '1');
      DT_COLUMNS.forEach((c, i) => {
        params.append(`columns[${i}][data]`, c);
        params.append(`columns[${i}][name]`, '');
        params.append(`columns[${i}][searchable]`, 'true');
        params.append(`columns[${i}][orderable]`, DT_NON_ORDERABLE.has(i) ? 'false' : 'true');
        params.append(`columns[${i}][search][value]`, '');
        params.append(`columns[${i}][search][regex]`, 'false');
      });
      params.append('start', '0');
      params.append('length', '10');
      params.append('search[value]', query);
      params.append('search[regex]', 'false');
      params.append('filter_situation', '0');
      params.append('filter_status', '0');
      params.append('filter_zone', '0');
      params.append('filter_city', '0');
      params.append('filter_address', '0');
      params.append('filter_users', '0');
      params.append('filter_by_date', 'LAST_UPDATE');
      params.append('f_time_s', fmtTime(fStart));
      params.append('f_time_e', fmtTime(fEnd));
      const rr = await fetch(`${BASE}/parcels_json`, {
        method: 'POST',
        headers: {
          'User-Agent': UA, 'Cookie': allCookies.join('; '), 'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json, text/javascript, */*; q=0.01', 'Referer': `${BASE}/parcels`,
          'Origin': BASE, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: params.toString(),
      });
      return { ok: rr.ok, status: rr.status, text: await rr.text() };
    }

    async function statusFor(query) {
      const pr = await queryParcels(query);
      if (!pr.ok || !pr.text.trim()) return null;
      let data;
      try { data = JSON.parse(pr.text); } catch { return pickStatus(pr.text) || null; }
      const rows = data.aaData || data.data || [];
      if (!rows.length) return null;
      // Correspondance EXACTE sur le code du colis pour éviter toute ambiguïté
      // (un client peut avoir plusieurs colis avec des statuts différents).
      const normCode = (r) => ((r.PARCEL_CODE || '') + '').replace(/<[^>]*>/g, '').trim();
      const exact = rows.find(r => normCode(r) === query);
      // Repli uniquement s'il n'y a qu'une seule ligne (aucune ambiguïté possible).
      const row = exact || (rows.length === 1 ? rows[0] : null);
      if (!row) return null;
      // PARCEL_STATUT peut être un libellé, un badge HTML ou un code interne.
      return pickStatus(row.PARCEL_STATUT) || pickStatus(JSON.stringify(row)) || null;
    }

    // Lot → tableau de résultats. Requête unique → objet simple (compat).
    if (batchRaw) {
      const results = [];
      for (const q of queries) {
        const st = await statusFor(q);
        results.push({ q, found: !!st, status: st });
      }
      return res.json({ results, source: 'ozone' });
    }
    const status = await statusFor(queries[0]);
    return res.json({ found: !!status, status: status || null, source: 'ozone' });
  } catch (e) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
