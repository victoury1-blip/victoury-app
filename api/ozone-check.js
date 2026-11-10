import { isAuthenticated } from './_auth.js';
import { rateLimited, clientIp } from './_rateLimit.js';

/* Historique d'un numéro sur le site d'Ozon (« Ce numéro existe déjà.
 * (Livré : X) (Retourné : Y) ») — l'API officielle n'a pas cette recherche.
 *
 * Lenteur : la connexion au site d'Ozon prend plusieurs allers-retours. Elle
 * se faisait à CHAQUE numéro ; la session est maintenant gardée en mémoire
 * (instance Vercel encore chaude) et refaite seulement si Ozon l'a expirée.
 * Le résultat d'un numéro est aussi gardé quelques minutes. */

const BASE = 'https://client.ozoneexpress.ma';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const DUREE_SESSION = 25 * 60_000;
const DUREE_RESULTAT = 10 * 60_000;

let session = null;            // { cookies: string[], at: number }
const resultats = new Map();   // phone -> { data, at }

function extractCookies(response) {
  const all = [];
  response.headers.forEach((val, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      val.split(/,(?=[^ ])/).forEach(c => {
        const name = c.split(';')[0].trim();
        if (name) all.push(name);
      });
    }
  });
  return all;
}

function mergeCookies(...arrays) {
  const map = new Map();
  for (const arr of arrays) {
    for (const c of arr) {
      const eqIdx = c.indexOf('=');
      if (eqIdx > 0) map.set(c.substring(0, eqIdx), c);
    }
  }
  return [...map.values()];
}


async function seConnecter(EMAIL, PASS) {
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
    if (inp.type === 'hidden' && inp.name !== 'email' && inp.name !== 'password') {
      body1.append(inp.name, inp.value);
    }
  }

  const loginRes1 = await fetch(`${BASE}/login?action=login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
      'Cookie': cookies1.join('; '),
      'Referer': `${BASE}/login`,
      'Origin': BASE,
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'application/json, text/html, */*',
    },
    body: body1.toString(),
    redirect: 'manual',
  });
  await loginRes1.text();
  const cookies2 = extractCookies(loginRes1);
  let allCookies = mergeCookies(cookies1, cookies2);
  const redir1 = loginRes1.headers.get('location');

  const loginRes2 = await fetch(`${BASE}/login?action=login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': UA,
      'Cookie': cookies1.join('; '),
      'Referer': `${BASE}/login`,
      'Origin': BASE,
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'application/json, text/html, */*',
    },
    body: JSON.stringify({ login_customers_email: EMAIL, login_customers_password: PASS, remember: true }),
    redirect: 'manual',
  });
  await loginRes2.text();
  const cookies3 = extractCookies(loginRes2);
  allCookies = mergeCookies(allCookies, cookies3);
  const redir2 = loginRes2.headers.get('location');

  const loginRes3 = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
      'Cookie': cookies1.join('; '),
      'Referer': `${BASE}/login`,
      'Origin': BASE,
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'application/json, text/html, */*',
    },
    body: body1.toString(),
    redirect: 'manual',
  });
  await loginRes3.text();
  const cookies4 = extractCookies(loginRes3);
  allCookies = mergeCookies(allCookies, cookies4);
  const redir3 = loginRes3.headers.get('location');

  const redir = redir1 || redir2 || redir3;
  if (redir) {
    const redirUrl = redir.startsWith('http') ? redir : `${BASE}${redir.startsWith('/') ? '' : '/'}${redir}`;
    const redirRes = await fetch(redirUrl, {
      headers: { 'User-Agent': UA, 'Cookie': allCookies.join('; ') },
      redirect: 'manual',
    });
    allCookies = mergeCookies(allCookies, extractCookies(redirRes));
  }

  const checkRes = await fetch(`${BASE}/parcels?action=add`, {
    headers: { 'User-Agent': UA, 'Cookie': allCookies.join('; ') },
  });
  const checkHtml = await checkRes.text();
  const loggedIn = checkHtml.includes('VICTOURY') || checkHtml.includes('Nouveau Colis') || checkHtml.includes('parcel_phone');
  return loggedIn ? allCookies : null;
}

async function chercher(cookies, phone, method) {
  const safePhone = encodeURIComponent(phone);
  const opts = {
    method,
    redirect: 'manual',
    headers: {
      'User-Agent': UA,
      'Cookie': cookies.join('; '),
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'text/html, application/json, */*',
      'Referer': `${BASE}/parcels?action=add`,
    },
  };
  let u = `${BASE}/V2/BlackList/SearchAjax?Phone=${safePhone}`;
  if (method === 'POST') {
    u = `${BASE}/V2/BlackList/SearchAjax`;
    opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    opts.body = `Phone=${safePhone}`;
  }
  const rr = await fetch(u, opts);
  const text = rr.status >= 300 && rr.status < 400 ? '' : await rr.text();
  // Session expirée : Ozon redirige vers la connexion ou renvoie sa page.
  const expiree = (rr.status >= 300 && rr.status < 400) || rr.status === 401 || /login_customers_(email|password)/i.test(text);
  return { text, expiree };
}

async function rechercher(cookies, phone) {
  let r = await chercher(cookies, phone, 'GET');
  if (!r.expiree && !r.text.trim()) r = await chercher(cookies, phone, 'POST');
  return r;
}

function lire(html, phone) {
  if (!html.trim()) return { exists: false, source: 'ozone' };
  // tolérant aux variantes de libellés/espaces d'Ozon
  const livMatch = html.match(/Livr[ée]*\s*:?\s*(\d+)/i);
  const retMatch = html.match(/Retourn[ée]*\s*:?\s*(\d+)/i);
  const delivered = livMatch ? parseInt(livMatch[1], 10) : 0;
  const returned = retMatch ? parseInt(retMatch[1], 10) : 0;
  const low = html.toLowerCase();
  // le numéro figure dans la réponse => il existe déjà chez Ozon
  const digits = phone.replace(/\D/g, '');
  const phoneAppears = digits.length >= 8 && html.replace(/\D/g, '').includes(digits);
  const exists = delivered > 0 || returned > 0 || phoneAppears
    || low.includes('existe') || low.includes('blacklist') || low.includes('déjà');
  return { exists, delivered, returned, total: delivered + returned, source: 'ozone' };
}

export default async function handler(req, res) {
  if (!(await isAuthenticated(req))) return res.status(401).json({ error: 'Non autorisé' });

  if (rateLimited(`ozone-check:${clientIp(req)}`, 20, 60000)) {
    return res.status(429).json({ error: 'Trop de requêtes. Réessayez dans une minute.' });
  }

  const phone = req.query.phone;
  if (!phone) return res.status(400).json({ error: 'phone required' });
  if (!/^\d{8,15}$/.test(phone)) {
    return res.status(400).json({ error: 'Format de téléphone invalide' });
  }

  const EMAIL = process.env.OZONE_EMAIL;
  const PASS = process.env.OZONE_PASS;
  if (!EMAIL || !PASS) {
    return res.status(500).json({ error: 'Ozone credentials not configured' });
  }

  const deja = resultats.get(phone);
  if (deja && Date.now() - deja.at < DUREE_RESULTAT) return res.json(deja.data);

  try {
    let neuve = false;
    if (!session || Date.now() - session.at > DUREE_SESSION) {
      const cookies = await seConnecter(EMAIL, PASS);
      if (!cookies) { session = null; return res.status(401).json({ error: 'login_failed' }); }
      session = { cookies, at: Date.now() };
      neuve = true;
    }
    let r = await rechercher(session.cookies, phone);
    if (r.expiree && !neuve) {
      const cookies = await seConnecter(EMAIL, PASS);
      if (!cookies) { session = null; return res.status(401).json({ error: 'login_failed' }); }
      session = { cookies, at: Date.now() };
      r = await rechercher(session.cookies, phone);
    }
    if (r.expiree) { session = null; return res.status(401).json({ error: 'login_failed' }); }
    const data = lire(r.text, phone);
    resultats.set(phone, { data, at: Date.now() });
    return res.json(data);
  } catch (e) {
    session = null;
    return res.status(500).json({ error: `Erreur serveur : ${e?.message || 'inconnue'}` });
  }
}
