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
    // Step 1: GET login page to get session cookie
    const loginPage = await fetch(`${BASE}/login`, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
      redirect: 'follow',
    });
    const loginHtml = await loginPage.text();
    const cookies1 = extractCookies(loginPage);

    // Extract all input fields from login form
    const allInputs = [];
    const inputPattern = /<input[^>]*>/gi;
    let im;
    while ((im = inputPattern.exec(loginHtml)) !== null) {
      const nameM = im[0].match(/name=["']([^"']+)["']/);
      const typeM = im[0].match(/type=["']([^"']+)["']/);
      const valM = im[0].match(/value=["']([^"']*?)["']/);
      if (nameM) allInputs.push({ name: nameM[1], type: typeM ? typeM[1] : 'text', value: valM ? valM[1] : '' });
    }

    // Try Method 1: POST form-urlencoded to login?action=login
    const body1 = new URLSearchParams();
    body1.append('login_customers_email', EMAIL);
    body1.append('login_customers_password', PASS);
    body1.append('remember', 'on');
    // Add any hidden fields
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
    const loginBody1 = await loginRes1.text();
    const cookies2 = extractCookies(loginRes1);
    let allCookies = mergeCookies(cookies1, cookies2);
    const redir1 = loginRes1.headers.get('location');

    // Try Method 2: POST JSON
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
    const loginBody2 = await loginRes2.text();
    const cookies3 = extractCookies(loginRes2);
    allCookies = mergeCookies(allCookies, cookies3);
    const redir2 = loginRes2.headers.get('location');

    // Try Method 3: POST to /login (without ?action=login)
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
    const loginBody3 = await loginRes3.text();
    const cookies4 = extractCookies(loginRes3);
    allCookies = mergeCookies(allCookies, cookies4);
    const redir3 = loginRes3.headers.get('location');

    // Follow any redirect we got
    const redir = redir1 || redir2 || redir3;
    if (redir) {
      const redirUrl = redir.startsWith('http') ? redir : `${BASE}${redir.startsWith('/') ? '' : '/'}${redir}`;
      const redirRes = await fetch(redirUrl, {
        headers: { 'User-Agent': UA, 'Cookie': allCookies.join('; ') },
        redirect: 'manual',
      });
      allCookies = mergeCookies(allCookies, extractCookies(redirRes));
    }

    // Check if logged in
    const checkRes = await fetch(`${BASE}/parcels?action=add`, {
      headers: { 'User-Agent': UA, 'Cookie': allCookies.join('; ') },
    });
    const checkHtml = await checkRes.text();
    const loggedIn = checkHtml.includes('VICTOURY') || checkHtml.includes('Nouveau Colis') || checkHtml.includes('parcel_phone');

    if (loggedIn) {
      // The correct endpoint: V2/BlackList/SearchAjax?Phone=XXXX
      const r = await fetch(`${BASE}/V2/BlackList/SearchAjax?Phone=${phone}`, {
        headers: {
          'User-Agent': UA,
          'Cookie': allCookies.join('; '),
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'text/html, application/json, */*',
          'Referer': `${BASE}/parcels?action=add`,
        },
      });
      const html = await r.text();

      if (html.trim()) {
        // Parse: "Ce numéro existe déjà. ( Livré : 1) ( Retourné : 0) fois."
        const livMatch = html.match(/Livr[ée]*\s*:\s*(\d+)/i);
        const retMatch = html.match(/Retourn[ée]*\s*:\s*(\d+)/i);
        const delivered = livMatch ? parseInt(livMatch[1], 10) : 0;
        const returned = retMatch ? parseInt(retMatch[1], 10) : 0;
        const exists = delivered > 0 || returned > 0 || html.toLowerCase().includes('existe');
        return res.json({ exists, delivered, returned, total: delivered + returned, source: 'ozone' });
      }

      // Empty response = new number
      return res.json({ exists: false, source: 'ozone' });
    }

    // Not logged in — return debug
    return res.json({
      error: 'login_failed',
      formInputs: allInputs,
      method1: { status: loginRes1.status, redirect: redir1 || 'none', body: loginBody1.substring(0, 1000) },
      method2: { status: loginRes2.status, redirect: redir2 || 'none', body: loginBody2.substring(0, 1000) },
      sentBody: body1.toString(),
      cookieCount: allCookies.length,
      loginPageSize: loginHtml.length,
      formSnippet: loginHtml.substring(loginHtml.indexOf('<form'), loginHtml.indexOf('</form>') + 7).substring(0, 2000),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message, stack: e.stack?.substring(0, 300) });
  }
}
