export default async function handler(req, res) {
  const phone = req.query.phone;
  if (!phone) return res.status(400).json({ error: 'phone required' });

  const EMAIL = 'victoury1@gmail.com';
  const PASS = '0663372556@SIMO@SIMO@';
  const BASE = 'https://client.ozoneexpress.ma';

  try {
    // Step 1: GET login page to get CSRF token + session cookie
    const loginPage = await fetch(`${BASE}/login`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' },
      redirect: 'manual',
    });
    const loginHtml = await loginPage.text();
    const cookies = (loginPage.headers.get('set-cookie') || '').split(',').map(c => c.split(';')[0].trim()).filter(Boolean);
    const tokenMatch = loginHtml.match(/name="_token"\s+value="([^"]+)"/);
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
        'User-Agent': 'Mozilla/5.0',
        'Cookie': cookies.join('; '),
      },
      body: body.toString(),
      redirect: 'manual',
    });
    const loginCookies = (loginRes.headers.get('set-cookie') || '').split(',').map(c => c.split(';')[0].trim()).filter(Boolean);
    const allCookies = [...cookies, ...loginCookies].filter(Boolean);

    // Step 3: Call blacklist endpoint with session
    const checkRes = await fetch(`${BASE}/V2/blacklist/search&jaxPhone=${phone}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Cookie': allCookies.join('; '),
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'text/html, */*',
      },
    });
    const html = await checkRes.text();

    const livMatch = html.match(/Livr[ée]*\s*:\s*(\d+)/i);
    const retMatch = html.match(/Retourn[ée]*\s*:\s*(\d+)/i);

    if (livMatch || retMatch || html.includes('existe') || html.includes('nouveau') || html.includes('blackListResult')) {
      const delivered = livMatch ? parseInt(livMatch[1], 10) : 0;
      const returned = retMatch ? parseInt(retMatch[1], 10) : 0;
      const exists = delivered > 0 || returned > 0 || html.toLowerCase().includes('existe');
      return res.json({ exists, delivered, returned, total: delivered + returned, source: 'ozone' });
    }

    return res.json({ error: 'unrecognized_response', snippet: html.substring(0, 300) });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
