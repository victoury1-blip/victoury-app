export default async function handler(req, res) {
  const phone = req.query.phone;
  if (!phone) return res.status(400).json({ error: 'phone required' });

  const EMAIL = 'victoury1@gmail.com';
  const PASS = '0663372556@SIMO@SIMO@';
  const BASE = 'https://client.ozoneexpress.ma';

  try {
    // Step 1: GET login page to get CSRF token + session cookie
    const loginPage = await fetch(`${BASE}/login`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
      redirect: 'manual',
    });
    const loginHtml = await loginPage.text();
    const rawCookies = loginPage.headers.raw?.()?.['set-cookie'] || [];
    const cookies = (Array.isArray(rawCookies) ? rawCookies : [loginPage.headers.get('set-cookie') || ''])
      .flatMap(c => c.split(/,(?=\s*\w+=)/)).map(c => c.split(';')[0].trim()).filter(Boolean);
    const tokenMatch = loginHtml.match(/name="_token"\s+value="([^"]+)"/) || loginHtml.match(/name='_token'\s+value='([^']+)'/);
    const token = tokenMatch ? tokenMatch[1] : '';

    // Step 2: POST login with credentials
    const body = new URLSearchParams();
    body.append('email', EMAIL);
    body.append('password', PASS);
    if (token) body.append('_token', token);

    const loginRes = await fetch(`${BASE}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': cookies.join('; '),
        'Referer': `${BASE}/login`,
      },
      body: body.toString(),
      redirect: 'manual',
    });
    const rawLogin = loginRes.headers.raw?.()?.['set-cookie'] || [];
    const loginCookies = (Array.isArray(rawLogin) ? rawLogin : [loginRes.headers.get('set-cookie') || ''])
      .flatMap(c => c.split(/,(?=\s*\w+=)/)).map(c => c.split(';')[0].trim()).filter(Boolean);
    const allCookies = [...cookies, ...loginCookies].filter(Boolean);

    // Step 3: Try multiple URL patterns for blacklist check
    const urls = [
      `${BASE}/V2/blacklist/search?jaxPhone=${phone}`,
      `${BASE}/V2/blacklist/search%26jaxPhone=${phone}`,
      `${BASE}/blacklist/search?jaxPhone=${phone}`,
      `${BASE}/parcels?action=checkPhone&phone=${phone}`,
      `${BASE}/ajax/checkPhone?phone=${phone}`,
    ];

    for (const url of urls) {
      try {
        const checkRes = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Cookie': allCookies.join('; '),
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'text/html, application/json, */*',
            'Referer': `${BASE}/parcels?action=add`,
          },
        });
        const html = await checkRes.text();

        const livMatch = html.match(/Livr[ée]*\s*:\s*(\d+)/i);
        const retMatch = html.match(/Retourn[ée]*\s*:\s*(\d+)/i);

        if (livMatch || retMatch || html.includes('existe') || html.includes('blackListResult')) {
          const delivered = livMatch ? parseInt(livMatch[1], 10) : 0;
          const returned = retMatch ? parseInt(retMatch[1], 10) : 0;
          const exists = delivered > 0 || returned > 0 || html.toLowerCase().includes('existe');
          return res.json({ exists, delivered, returned, total: delivered + returned, source: 'ozone', url });
        }
        if (html.includes('nouveau') || html.includes('Nouveau')) {
          return res.json({ exists: false, source: 'ozone', url });
        }
      } catch {}
    }

    // Debug: return login status + last attempt info
    const debugRes = await fetch(`${BASE}/parcels?action=add`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': allCookies.join('; '),
      },
    });
    const debugHtml = await debugRes.text();
    const loggedIn = debugHtml.includes('VICTOURY') || debugHtml.includes('Nouveau Colis') || debugHtml.includes('parcel_phone');

    return res.json({
      error: 'no_endpoint_worked',
      loggedIn,
      cookieCount: allCookies.length,
      token: token ? 'found' : 'missing',
      loginStatus: loginRes.status,
      debugSnippet: debugHtml.substring(0, 500),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
