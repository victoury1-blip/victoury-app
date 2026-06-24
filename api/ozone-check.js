export default async function handler(req, res) {
  const phone = req.query.phone;
  if (!phone) return res.status(400).json({ error: 'phone required' });

  const EMAIL = 'victoury1@gmail.com';
  const PASS = '0663372556@SIMO@SIMO@';
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

  try {
    // Step 1: GET login page
    const loginPage = await fetch(`${BASE}/login`, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' },
      redirect: 'follow',
    });
    const loginHtml = await loginPage.text();
    const cookies1 = extractCookies(loginPage);

    // Try multiple token patterns
    const tokenMatch = loginHtml.match(/name="_token"[^>]*value="([^"]+)"/)
      || loginHtml.match(/value="([^"]+)"[^>]*name="_token"/)
      || loginHtml.match(/name='_token'[^>]*value='([^']+)'/)
      || loginHtml.match(/csrf[_-]?token['"]\s*(?:content|value)=['"]\s*([^'"]+)/i)
      || loginHtml.match(/meta\s+name="csrf-token"\s+content="([^"]+)"/);
    const token = tokenMatch ? tokenMatch[1] : '';

    // Step 2: POST login
    const body = new URLSearchParams();
    body.append('email', EMAIL);
    body.append('password', PASS);
    if (token) body.append('_token', token);
    body.append('remember', 'on');

    const loginRes = await fetch(`${BASE}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': UA,
        'Cookie': cookies1.join('; '),
        'Referer': `${BASE}/login`,
        'Origin': BASE,
      },
      body: body.toString(),
      redirect: 'manual',
    });
    const cookies2 = extractCookies(loginRes);
    const allCookies = [...cookies1, ...cookies2];

    // Follow redirect if any
    const redir = loginRes.headers.get('location');
    let cookies3 = [];
    if (redir) {
      const redirUrl = redir.startsWith('http') ? redir : `${BASE}${redir}`;
      const redirRes = await fetch(redirUrl, {
        headers: { 'User-Agent': UA, 'Cookie': allCookies.join('; ') },
        redirect: 'manual',
      });
      cookies3 = extractCookies(redirRes);
    }
    const finalCookies = [...allCookies, ...cookies3];

    // Step 3: Try blacklist URLs
    const urls = [
      `${BASE}/V2/blacklist/search?jaxPhone=${phone}`,
      `${BASE}/V2/blacklist/search%26jaxPhone%3D${phone}`,
      `${BASE}/blacklist/search?jaxPhone=${phone}`,
      `${BASE}/parcels?action=checkPhone&phone=${phone}`,
    ];

    for (const url of urls) {
      try {
        const r = await fetch(url, {
          headers: {
            'User-Agent': UA,
            'Cookie': finalCookies.join('; '),
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'text/html, application/json, */*',
            'Referer': `${BASE}/parcels?action=add`,
          },
        });
        const html = await r.text();
        if (r.status >= 400 || html.includes('ErrorDocument') || html.includes('<!DOCTYPE HTML PUBLIC')) continue;

        const livMatch = html.match(/Livr[ée]*\s*:\s*(\d+)/i);
        const retMatch = html.match(/Retourn[ée]*\s*:\s*(\d+)/i);

        if (livMatch || retMatch || html.includes('existe') || html.includes('blackListResult')) {
          const delivered = livMatch ? parseInt(livMatch[1], 10) : 0;
          const returned = retMatch ? parseInt(retMatch[1], 10) : 0;
          const exists = delivered > 0 || returned > 0 || html.toLowerCase().includes('existe');
          return res.json({ exists, delivered, returned, total: delivered + returned, source: 'ozone' });
        }
        if (html.includes('nouveau') || html.includes('Nouveau')) {
          return res.json({ exists: false, source: 'ozone' });
        }
      } catch {}
    }

    // Debug
    const debugRes = await fetch(`${BASE}/parcels?action=add`, {
      headers: { 'User-Agent': UA, 'Cookie': finalCookies.join('; ') },
    });
    const dHtml = await debugRes.text();
    const loggedIn = dHtml.includes('VICTOURY') || dHtml.includes('Nouveau Colis') || dHtml.includes('parcel_phone');

    return res.json({
      error: 'no_endpoint_worked',
      loggedIn,
      cookieCount: finalCookies.length,
      token: token ? token.substring(0, 10) + '...' : 'missing',
      loginStatus: loginRes.status,
      loginRedirect: redir || 'none',
      debugSnippet: dHtml.substring(0, 500),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message, stack: e.stack?.substring(0, 200) });
  }
}
