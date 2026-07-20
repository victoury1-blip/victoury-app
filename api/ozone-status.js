// Récupère le STATUT réel d'un colis depuis le tableau de bord Ozon (client.ozoneexpress.ma),
// via l'endpoint DataTables `parcels_json`, en cherchant par code d'envoi ou par téléphone.
// Renvoie uniquement { found, status } — pas de HTML tiers brut.

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

function pickStatus(text) {
  const low = text.toLowerCase();
  for (const kw of STATUS_KEYWORDS) {
    if (low.includes(kw.toLowerCase())) return kw;
  }
  return '';
}

export default async function handler(req, res) {
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

    // 2) Interroger le DataTables parcels_json avec une valeur de recherche (code ou téléphone).
    async function queryParcels(query, method) {
      const params = new URLSearchParams();
      params.append('draw', '1');
      params.append('start', '0');
      params.append('length', '10');
      params.append('search[value]', query);
      params.append('search[regex]', 'false');
      const headers = {
        'User-Agent': UA, 'Cookie': allCookies.join('; '), 'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/javascript, */*; q=0.01', 'Referer': `${BASE}/parcels`,
      };
      let url = `${BASE}/parcels_json?${params.toString()}`;
      const opts = { method, headers };
      if (method === 'POST') {
        url = `${BASE}/parcels_json`;
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        opts.body = params.toString();
      }
      const rr = await fetch(url, opts);
      return { ok: rr.ok, status: rr.status, text: await rr.text() };
    }

    async function statusFor(query) {
      let pr = await queryParcels(query, 'GET');
      if (!pr.ok || !pr.text.trim() || pr.text.trim().startsWith('<')) pr = await queryParcels(query, 'POST');
      if (!pr.ok || !pr.text.trim()) return null;
      // Isole le segment contenant la valeur recherchée puis extrait le statut ; sinon scanne tout.
      let scope = pr.text;
      const idx = pr.text.indexOf(query);
      if (idx >= 0) scope = pr.text.substring(idx, idx + 2000);
      return pickStatus(scope) || pickStatus(pr.text) || null;
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
