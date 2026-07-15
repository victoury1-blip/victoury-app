const rateLimitMap = new Map();

function rateLimit(ip, maxRequests = 10, windowMs = 60000) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.start > windowMs) {
    rateLimitMap.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count++;
  return entry.count > maxRequests;
}

export default async function handler(req, res) {
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (rateLimit(clientIp)) {
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

  const BASE = 'https://client.ozoneexpress.ma';
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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

  try {
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

    // Les modes de diagnostic (debug/findurl) renvoyaient du HTML Ozon brut
    // (données tierces potentielles) sans authentification : supprimés.

    if (loggedIn) {
      const safePhone = encodeURIComponent(phone);
      // essaie GET puis POST (Ozon peut exiger l'un ou l'autre)
      async function search(method) {
        const opts = {
          method,
          headers: {
            'User-Agent': UA,
            'Cookie': allCookies.join('; '),
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
        return { status: rr.status, text: await rr.text() };
      }
      let sr = await search('GET');
      if (!sr.text.trim()) sr = await search('POST');
      const html = sr.text;

      if (html.trim()) {
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
        return res.json({ exists, delivered, returned, total: delivered + returned, source: 'ozone' });
      }

      return res.json({ exists: false, source: 'ozone' });
    }

    return res.status(401).json({ error: 'login_failed' });
  } catch (e) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
