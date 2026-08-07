// Récupère le STATUT réel d'un colis depuis le tableau de bord Ozon (client.ozoneexpress.ma),
// via l'endpoint DataTables `parcels_json`, en cherchant par code d'envoi ou par téléphone.
// Renvoie uniquement { found, status } — pas de HTML tiers brut.

import { isAuthenticated } from './_auth.js';
import { rateLimited, clientIp } from './_rateLimit.js';

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

  if (rateLimited(`ozone-status:${clientIp(req)}`)) {
    return res.status(429).json({ error: 'Trop de requêtes. Réessayez dans une minute.' });
  }

  // Recherche unique (?code= / ?phone=) OU lot (?codes=A,B,C — jusqu'à 40).
  // Le lot ne se connecte qu'UNE fois à Ozon puis interroge chaque valeur.
  const batchRaw = (req.query.codes || '').toString().trim();
  // Recherche par TÉLÉPHONE renvoyant le CODE réel du colis chez Ozon
  // (?phones=06..,06..). Sert à retrouver le code d'envoi d'une commande dont
  // le code local a été écrasé. Un téléphone portant plusieurs colis est
  // signalé « ambigu » et jamais deviné.
  const listMode = String(req.query.list || '') === '1';
  const phonesRaw = (req.query.phones || '').toString().trim();
  const queries = phonesRaw
    ? phonesRaw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 40)
    : batchRaw
      ? batchRaw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 40)
      : [(req.query.code || req.query.phone || '').toString().trim()].filter(Boolean);
  if (!listMode) {
    if (!queries.length) return res.status(400).json({ error: 'code, phone or codes required' });
    if (queries.some(q => !/^[A-Za-z0-9]{3,30}$/.test(q))) return res.status(400).json({ error: 'Format invalide' });
  }

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
    async function queryParcels(query, start = 0, length = 10) {
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
      params.append('start', String(start));
      params.append('length', String(length));
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

    /* Code réel du colis pour un téléphone donné. Renvoie le code UNIQUEMENT
       si la recherche remonte exactement une ligne : avec plusieurs colis pour
       le même numéro, impossible de savoir lequel correspond. */
    async function codeFor(query) {
      const pr = await queryParcels(query);
      if (!pr.ok || !pr.text.trim()) return { code: null, ambiguous: false };
      let data;
      try { data = JSON.parse(pr.text); } catch { return { code: null, ambiguous: false }; }
      const rows = data.aaData || data.data || [];
      if (!rows.length) return { code: null, ambiguous: false };
      if (rows.length > 1) return { code: null, ambiguous: true };
      // PARCEL_CODE est une cellule HTML qui contient le code ET, en dessous, le
      // livreur et son téléphone. Après suppression des balises, tout se
      // retrouve collé : on ne garde donc que le PREMIER jeton, et seulement
      // s'il a la forme d'un code de colis.
      const raw = ((rows[0].PARCEL_CODE || '') + '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .trim();
      const m = raw.match(/^[A-Za-z0-9_-]{3,30}/);
      const code = m ? m[0] : null;
      return { code, ambiguous: false, status: pickStatus(rows[0].PARCEL_STATUT) || null };
    }

    if (phonesRaw) {
      const results = [];
      for (const q of queries) {
        const r = await codeFor(q);
        results.push({ q, code: r.code, ambiguous: r.ambiguous, status: r.status || null });
      }
      return res.json({ results, source: 'ozone' });
    }

    /* Mode INVENTAIRE : renvoie une page de colis (code + téléphone), pour que
       le client reconstitue lui-même la correspondance téléphone → code.
       Interroger Ozon commande par commande imposerait une connexion par appel :
       impraticable sur des milliers de commandes. */
    if (listMode) {
      const start = Math.max(0, parseInt(req.query.start || '0', 10) || 0);
      const length = Math.min(200, Math.max(1, parseInt(req.query.length || '100', 10) || 100));
      const pr = await queryParcels('', start, length);
      if (!pr.ok || !pr.text.trim()) return res.status(502).json({ error: 'Réponse Ozon vide' });
      let data;
      try { data = JSON.parse(pr.text); } catch { return res.status(502).json({ error: 'Réponse Ozon illisible' }); }
      const rows = data.aaData || data.data || [];
      const strip = (v) => String(v || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').trim();
      const parcels = rows.map(r => {
        const codeRaw = strip(r.PARCEL_CODE);
        const m = codeRaw.match(/^[A-Za-z0-9_-]{3,30}/);
        // Le téléphone n'a pas de colonne dédiée : on le repère dans la ligne.
        const phoneM = strip(JSON.stringify(r)).match(/0[5-7]\d{8}/);
        return {
          code: m ? m[0] : null,
          phone: phoneM ? phoneM[0] : null,
          status: pickStatus(r.PARCEL_STATUT) || null,
        };
      }).filter(p => p.code);
      return res.json({
        parcels,
        total: data.recordsTotal ?? data.iTotalRecords ?? null,
        start, length, source: 'ozone',
      });
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
