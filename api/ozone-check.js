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
      // Try multiple methods to search blacklist
      // First: scan parcels page source for AJAX endpoints related to phone/blacklist
      const parcelsPage = await fetch(`${BASE}/parcels?action=add`, {
        headers: { 'User-Agent': UA, 'Cookie': allCookies.join('; ') },
      });
      const parcelsHtml = await parcelsPage.text();

      // Find all ajaxLink calls and URLs mentioning blacklist/phone
      const ajaxLinks = [];
      const ajaxPattern = /ajaxLink\s*\(\s*['"]([^'"]+)['"]/g;
      let m;
      while ((m = ajaxPattern.exec(parcelsHtml)) !== null) {
        ajaxLinks.push(m[1]);
      }

      // Find any URL/endpoint mentioning phone, blacklist, or search
      const phoneRelated = [];
      const urlPattern = /['"]([^'"]*(?:phone|blacklist|search|check)[^'"]*)['"]/gi;
      while ((m = urlPattern.exec(parcelsHtml)) !== null) {
        if (m[1].length < 200) phoneRelated.push(m[1]);
      }

      // Find the blackListResult element and surrounding JS
      const blIdx = parcelsHtml.indexOf('blackListResult');
      const blacklistContext = blIdx >= 0 ? parcelsHtml.substring(Math.max(0, blIdx - 500), blIdx + 500) : 'not found';

      // Find parcel_phone input and surrounding JS
      const phIdx = parcelsHtml.indexOf('parcel_phone');
      const phoneContext = phIdx >= 0 ? parcelsHtml.substring(Math.max(0, phIdx - 300), phIdx + 500) : 'not found';

      // Now try the ajaxLink URLs we found
      const results = [];
      for (const link of ajaxLinks) {
        if (!link.includes('blacklist') && !link.includes('phone') && !link.includes('search')) continue;
        const url = `${BASE}/${link.replace(/&jaxPhone=.*/, '')}?jaxPhone=${phone}`;
        try {
          const r = await fetch(url, {
            headers: {
              'User-Agent': UA,
              'Cookie': allCookies.join('; '),
              'X-Requested-With': 'XMLHttpRequest',
              'Accept': '*/*',
              'Referer': `${BASE}/parcels?action=add`,
            },
          });
          const html = await r.text();
          results.push({ url, status: r.status, len: html.trim().length, body: html.substring(0, 500) });
        } catch {}
      }

      return res.json({
        error: 'debug_parcels_page',
        loggedIn: true,
        phone,
        ajaxLinks,
        phoneRelated: phoneRelated.slice(0, 20),
        blacklistContext: blacklistContext.replace(/\s+/g, ' ').substring(0, 1000),
        phoneContext: phoneContext.replace(/\s+/g, ' ').substring(0, 800),
        results,
      });
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
