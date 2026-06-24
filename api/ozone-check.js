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
    // Step 1: GET login page
    const loginPage = await fetch(`${BASE}/login`, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
      redirect: 'follow',
    });
    const loginHtml = await loginPage.text();
    const cookies1 = extractCookies(loginPage);

    // Extract all hidden inputs from the form
    const hiddenInputs = {};
    const hiddenPattern = /<input[^>]*type=["']hidden["'][^>]*>/gi;
    let hMatch;
    while ((hMatch = hiddenPattern.exec(loginHtml)) !== null) {
      const nameM = hMatch[0].match(/name=["']([^"']+)["']/);
      const valM = hMatch[0].match(/value=["']([^"']+)["']/);
      if (nameM) hiddenInputs[nameM[1]] = valM ? valM[1] : '';
    }

    // Find the form action URL
    const formActionMatch = loginHtml.match(/form[^>]*action=["']([^"']+)["']/);
    const formAction = formActionMatch ? formActionMatch[1] : `${BASE}/login`;
    const loginUrl = formAction.startsWith('http') ? formAction : `${BASE}/${formAction.replace(/^\//, '')}`;

    // Find input field names for email and password
    const emailFieldMatch = loginHtml.match(/<input[^>]*type=["'](?:email|text)["'][^>]*name=["']([^"']+)["']/i)
      || loginHtml.match(/<input[^>]*name=["']([^"']+)["'][^>]*type=["'](?:email|text)["']/i);
    const passFieldMatch = loginHtml.match(/<input[^>]*type=["']password["'][^>]*name=["']([^"']+)["']/i)
      || loginHtml.match(/<input[^>]*name=["']([^"']+)["'][^>]*type=["']password["']/i);

    const emailField = emailFieldMatch ? emailFieldMatch[1] : 'email';
    const passField = passFieldMatch ? passFieldMatch[1] : 'password';

    // Step 2: POST login
    const body = new URLSearchParams();
    body.append(emailField, EMAIL);
    body.append(passField, PASS);
    for (const [k, v] of Object.entries(hiddenInputs)) {
      body.append(k, v);
    }
    body.append('remember', 'on');

    const loginRes = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': UA,
        'Cookie': cookies1.join('; '),
        'Referer': `${BASE}/login`,
        'Origin': BASE,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: body.toString(),
      redirect: 'manual',
    });
    const cookies2 = extractCookies(loginRes);
    let allCookies = mergeCookies(cookies1, cookies2);
    const loginBody = await loginRes.text();

    // Follow redirect(s)
    let redir = loginRes.headers.get('location');
    if (redir) {
      const redirUrl = redir.startsWith('http') ? redir : `${BASE}${redir.startsWith('/') ? '' : '/'}${redir}`;
      const redirRes = await fetch(redirUrl, {
        headers: { 'User-Agent': UA, 'Cookie': allCookies.join('; ') },
        redirect: 'manual',
      });
      const cookies3 = extractCookies(redirRes);
      allCookies = mergeCookies(allCookies, cookies3);

      // Follow second redirect if needed
      const redir2 = redirRes.headers.get('location');
      if (redir2) {
        const redir2Url = redir2.startsWith('http') ? redir2 : `${BASE}${redir2.startsWith('/') ? '' : '/'}${redir2}`;
        const redir2Res = await fetch(redir2Url, {
          headers: { 'User-Agent': UA, 'Cookie': allCookies.join('; ') },
          redirect: 'manual',
        });
        allCookies = mergeCookies(allCookies, extractCookies(redir2Res));
      }
    }

    // Also try JSON login in case ajax-form expects JSON response
    if (!redir && loginRes.status === 200) {
      let jsonSuccess = false;
      try {
        const parsed = JSON.parse(loginBody);
        if (parsed.success || parsed.redirect || parsed.status === 'success') {
          jsonSuccess = true;
          if (parsed.redirect) {
            const jUrl = parsed.redirect.startsWith('http') ? parsed.redirect : `${BASE}/${parsed.redirect.replace(/^\//, '')}`;
            const jRes = await fetch(jUrl, {
              headers: { 'User-Agent': UA, 'Cookie': allCookies.join('; ') },
              redirect: 'manual',
            });
            allCookies = mergeCookies(allCookies, extractCookies(jRes));
          }
        }
      } catch {}
    }

    // Step 3: Try blacklist search
    const searchUrl = `${BASE}/V2/blacklist/search`;
    const r = await fetch(`${searchUrl}?jaxPhone=${phone}`, {
      headers: {
        'User-Agent': UA,
        'Cookie': allCookies.join('; '),
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'text/html, application/json, */*',
        'Referer': `${BASE}/parcels?action=add`,
      },
    });
    const html = await r.text();

    // Check if we got a valid blacklist response
    if (r.status < 400 && !html.includes('<!DOCTYPE') && !html.includes('window.location')) {
      const livMatch = html.match(/Livr[ée]*\s*:\s*(\d+)/i);
      const retMatch = html.match(/Retourn[ée]*\s*:\s*(\d+)/i);

      if (livMatch || retMatch || html.includes('existe') || html.includes('blackListResult') || html.includes('blacklist')) {
        const delivered = livMatch ? parseInt(livMatch[1], 10) : 0;
        const returned = retMatch ? parseInt(retMatch[1], 10) : 0;
        const exists = delivered > 0 || returned > 0 || html.toLowerCase().includes('existe');
        return res.json({ exists, delivered, returned, total: delivered + returned, source: 'ozone' });
      }
      if (html.includes('nouveau') || html.includes('Nouveau') || html.trim() === '' || html.includes('Aucun')) {
        return res.json({ exists: false, source: 'ozone' });
      }
    }

    // Debug: check if logged in
    const debugRes = await fetch(`${BASE}/parcels?action=add`, {
      headers: { 'User-Agent': UA, 'Cookie': allCookies.join('; ') },
    });
    const dHtml = await debugRes.text();
    const loggedIn = dHtml.includes('VICTOURY') || dHtml.includes('Nouveau Colis') || dHtml.includes('parcel_phone');

    return res.json({
      error: 'no_endpoint_worked',
      loggedIn,
      cookieCount: allCookies.length,
      loginUrl,
      emailField,
      passField,
      hiddenInputs,
      loginStatus: loginRes.status,
      loginRedirect: redir || 'none',
      loginBodySnippet: loginBody.substring(0, 500),
      blacklistStatus: r.status,
      blacklistSnippet: html.substring(0, 500),
      debugLoggedIn: loggedIn,
      debugSnippet: dHtml.substring(0, 300),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message, stack: e.stack?.substring(0, 300) });
  }
}
