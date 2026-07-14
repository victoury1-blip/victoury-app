import { cloudSet } from './cloudSettings';

const STORAGE_KEY = 'chic_config';

/* Nom français approché d'une couleur CSS (hex ou rgb) — les pastilles de
   couleur de chic-affiliate.com n'ont pas de libellé, seulement un fond. */
const COLOR_PALETTE = [
  ['Noir', 15, 15, 15], ['Blanc', 250, 250, 250], ['Gris', 128, 128, 128],
  ['Rouge', 210, 30, 40], ['Bordeaux', 110, 0, 40], ['Rose', 250, 120, 170],
  ['Orange', 255, 140, 0], ['Jaune', 250, 210, 40], ['Vert', 40, 140, 60],
  ['Vert clair', 150, 230, 150], ['Bleu', 40, 90, 200], ['Bleu ciel', 135, 206, 235],
  ['Bleu marine', 10, 20, 90], ['Violet', 130, 40, 160], ['Mauve', 190, 150, 220],
  ['Marron', 120, 70, 30], ['Beige', 225, 205, 175], ['Kaki', 110, 130, 60],
];
export function colorNameFromCss(css) {
  if (!css) return '';
  let r, g, b;
  const hex = css.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (hex) {
    const h = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
    r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16);
  } else {
    const rgb = css.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (rgb) { r = +rgb[1]; g = +rgb[2]; b = +rgb[3]; }
    else {
      const named = { black: 'Noir', white: 'Blanc', green: 'Vert', red: 'Rouge', blue: 'Bleu', yellow: 'Jaune', pink: 'Rose', orange: 'Orange', purple: 'Violet', brown: 'Marron', gray: 'Gris', grey: 'Gris', beige: 'Beige', navy: 'Bleu marine' };
      return named[css.trim().toLowerCase()] || '';
    }
  }
  let best = '', bestD = Infinity;
  for (const [name, pr, pg, pb] of COLOR_PALETTE) {
    const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (d < bestD) { bestD = d; best = name; }
  }
  return best;
}

export function stripHtml(str) {
  if (!str || typeof str !== 'string') return '';
  const doc = new DOMParser().parseFromString(str, 'text/html');
  return doc.body.textContent || '';
}

export function getChicConfig() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

export function saveChicConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  cloudSet(STORAGE_KEY, config);
}

function proxyUrl(path, mode) {
  const config = getChicConfig();
  if (!config) throw new Error('Chic Affiliate non configuré');
  const params = new URLSearchParams({ path, session: config.sessionCookie });
  if (config.xsrfToken) params.set('xsrf', config.xsrfToken);
  if (mode) params.set('mode', mode);
  return `/api/chic-proxy?${params}`;
}

/* Signale à l'UI que la session Chic a expiré (cookies périmés) pour afficher
   la bannière de reconnexion. Renvoie true si c'est bien un 401/session. */
export function isSessionError(err) {
  const m = (err?.message || String(err || '')).toLowerCase();
  return m.includes('401') || m.includes('session') || m.includes('reconnect');
}
function flagSession(res, payload) {
  if (res.status === 401 || payload?.error?.toLowerCase?.().includes('session')) {
    try { window.dispatchEvent(new CustomEvent('chic-session-expired')); } catch {}
    return true;
  }
  return false;
}

export async function fetchChicOrders(startDate, endDate, start = 0, length = 50) {
  const params = new URLSearchParams({
    draw: '1',
    start: String(start),
    length: String(length),
    'columns[0][data]': 'id',
    'columns[0][searchable]': 'true',
    'order[0][column]': '0',
    'order[0][dir]': 'desc',
  });
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);

  const res = await fetch(proxyUrl(`/affiliate/orders/dataTables?${params}`));
  if (res.status === 401) { flagSession(res); throw new Error('Session Chic expirée — reconnectez-vous'); }
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  return res.json();
}

export async function fetchChicProducts() {
  const res = await fetch(proxyUrl('/affiliate/products', 'html'));
  if (res.status === 401) { flagSession(res); throw new Error('Session Chic expirée — reconnectez-vous'); }
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  const { html } = await res.json();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const products = [];
  const seen = new Set();

  /* Le chicId est porté par l'attribut data-id="203" de chaque carte produit
     (pas par un lien <a>). C'est INDISPENSABLE : sans lui, pas de détails ni
     d'envoi (d'où les anciennes Réf « CHIC-<timestamp> »). */
  const priceRe = /[\d.,]+\s*(?:MAD|DH|Dhs)/gi;
  const proxify = (src) => {
    if (!src) return '';
    const raw = src.startsWith('//') ? `https:${src}` : src.startsWith('/') ? `https://www.chic-affiliate.com${src}` : src;
    return `/api/chic-image?url=${encodeURIComponent(raw)}`;
  };
  const pickImg = (el) => {
    const img = el?.querySelector('img');
    return img?.getAttribute('data-src') || img?.getAttribute('data-lazy-src') || img?.getAttribute('data-original') || img?.getAttribute('src') || '';
  };

  doc.querySelectorAll('[data-id]').forEach(el => {
    const chicId = (el.getAttribute('data-id') || '').match(/^\d+$/)?.[0];
    if (!chicId || seen.has(chicId)) return;
    const card = el.closest('.card, [class*="col"], [class*="product"], li') || el;
    let name = card.querySelector('h5, h4, h3, .card-title, .product-name')?.textContent?.trim() || '';
    if (!name) name = (el.getAttribute('title') || el.getAttribute('data-name') || '').trim();
    const prices = (card.textContent || '').match(priceRe) || [];
    // ignorer les data-id qui ne sont pas des produits (aucun nom ni prix ni image)
    if (!name && prices.length === 0 && !pickImg(card)) return;
    seen.add(chicId);
    products.push({ name: name || `Produit ${chicId}`, chicId, salePrice: prices[0] || '', resellerPrice: prices[1] || '', image: proxify(pickImg(card)) });
  });

  /* Repli : liens numériques /affiliate/products/ID (si data-id absent). */
  if (products.length === 0) {
    doc.querySelectorAll('a[href*="/affiliate/products/"]').forEach(link => {
      const chicId = (link.getAttribute('href') || '').match(/\/affiliate\/products\/(\d+)/)?.[1];
      if (!chicId || seen.has(chicId)) return;
      const card = link.closest('.card, [class*="product"], li') || link.parentElement || link;
      const name = card.querySelector('h5, h4, h3, .card-title, .product-name')?.textContent?.trim() || (link.textContent || '').trim();
      const prices = (card.textContent || '').match(priceRe) || [];
      seen.add(chicId);
      products.push({ name: name || `Produit ${chicId}`, chicId, salePrice: prices[0] || '', resellerPrice: prices[1] || '', image: proxify(pickImg(card)) });
    });
  }

  if (products.length === 0) {
    return { data: [], recordsTotal: 0, html: (doc.body?.innerHTML || '').slice(0, 2000) };
  }
  return { data: products, recordsTotal: products.length };
}

/* Extrait le JSON embarqué d'une page Inertia/Laravel : les tailles, couleurs
   et images ne sont PAS dans le HTML brut mais dans data-page="{...}" (ou une
   variable JS). On le parse et on cherche récursivement les données produit. */
function extractInertiaData(html) {
  let json = null;
  const m = html.match(/data-page="([^"]+)"/);
  if (m) {
    const decoded = m[1]
      .replace(/&quot;/g, '"').replace(/&#34;/g, '"')
      .replace(/&#039;/g, "'").replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    try { json = JSON.parse(decoded); } catch {}
  }
  if (!json) {
    const m2 = html.match(/(?:window\.__(?:INITIAL_STATE|DATA|NUXT)__|__INERTIA__)\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/);
    if (m2) { try { json = JSON.parse(m2[1]); } catch {} }
  }
  return json;
}

/* Cherche récursivement dans l'objet Inertia le nœud produit et en tire
   tailles / couleurs / images. Robuste aux noms de clés variables. */
function harvestProduct(root) {
  const out = { sizes: [], colors: [], images: [], description: '', cities: [], token: '', productId: '' };
  if (!root || typeof root !== 'object') return out;
  const seen = new Set();
  const norm = s => String(s || '').toUpperCase().trim();

  const walk = (node) => {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    for (const [key, val] of Object.entries(node)) {
      const k = key.toLowerCase();
      // Tailles
      if (/(^|_)(sizes?|tailles?)$/.test(k) && Array.isArray(val)) {
        val.forEach(v => {
          const s = norm(typeof v === 'object' ? (v.name || v.label || v.value || v.size || v.taille) : v);
          if (s && !out.sizes.includes(s)) out.sizes.push(s);
        });
      }
      // Couleurs
      if (/(^|_)(colou?rs?|couleurs?)$/.test(k) && Array.isArray(val)) {
        val.forEach(v => {
          if (typeof v === 'object' && v) {
            const id = v.id ?? v.color_id ?? v.value;
            const label = v.name || v.label || v.title || '';
            const bg = v.code || v.hex || v.color || v.value_hex || v.background || '';
            if (id != null) out.colors.push({ id: String(id), label: label || colorNameFromCss(bg), bg });
          } else if (v != null) {
            out.colors.push({ id: String(v), label: '', bg: '' });
          }
        });
      }
      // Images / galerie
      if (/(images?|photos?|gallery|galerie)/.test(k)) {
        const arr = Array.isArray(val) ? val : (typeof val === 'string' ? [val] : []);
        arr.forEach(v => {
          let u = typeof v === 'object' ? (v.url || v.src || v.path || v.image || v.name) : v;
          if (typeof u === 'string' && u) {
            if (!/^https?:\/\//.test(u)) u = `https://www.chic-affiliate.com/${u.replace(/^\//, '')}`;
            if (!out.images.includes(u)) out.images.push(u);
          }
        });
      }
      // Villes
      if (/(cities|villes)/.test(k) && Array.isArray(val)) {
        val.forEach(v => {
          if (typeof v === 'object' && v) {
            const id = v.id ?? v.value; const name = v.name || v.label || v.ville;
            if (id != null && name) out.cities.push({ id: String(id), name: String(name) });
          }
        });
      }
      if (/description/.test(k) && typeof val === 'string' && val.length > out.description.length) out.description = val;
      if ((k === 'id' || k === 'product_id') && (typeof val === 'number' || typeof val === 'string') && !out.productId) out.productId = String(val);
      if (typeof val === 'object') walk(val);
    }
  };
  walk(root);
  return out;
}

/* Diagnostic de la LISTE des produits : montre comment les produits sont liés
   (URL, data-attributs) pour extraire le chicId de façon fiable. */
export async function diagnoseChicList() {
  const res = await fetch(proxyUrl('/affiliate/products', 'html'));
  if (res.status === 401) { flagSession(res); throw new Error('Session Chic expirée — reconnectez-vous'); }
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  const { html } = await res.json();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const anchors = [...doc.querySelectorAll('a')].map(a => a.getAttribute('href') || '').filter(h => /product/i.test(h));
  const productLinks = [...new Set(anchors)].slice(0, 15);
  const dataIds = [...html.matchAll(/data-(?:product-)?id=["'](\d+)["']/gi)].map(m => m[0]).slice(0, 10);
  const numericPaths = [...new Set([...html.matchAll(/\/affiliate\/products\/(\d+)/g)].map(m => m[0]))].slice(0, 10);
  const firstCardIdx = html.search(/choisir|product|carte|card|ajouter au panier|voir/i);
  return {
    htmlLength: html.length,
    anchorsWithProduct: productLinks,
    dataIdAttrs: dataIds,
    numericProductPaths: numericPaths,
    htmlSample: html.slice(Math.max(0, firstCardIdx - 100), firstCardIdx + 500).replace(/\s+/g, ' '),
  };
}

export async function fetchChicProductDetails(chicProductId) {
  const res = await fetch(proxyUrl(`/affiliate/products/${chicProductId}`, 'html'));
  if (res.status === 401) { flagSession(res); throw new Error('Session Chic expirée — reconnectez-vous'); }
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  const { html } = await res.json();
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const token = doc.querySelector('input[name="_token"]')?.value
    || doc.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
  const productId = doc.querySelector('input[name="product_id"]')?.value || chicProductId;

  /* Source prioritaire : le JSON Inertia embarqué (données produit fiables). */
  const inertia = extractInertiaData(html);
  const fromJson = inertia ? harvestProduct(inertia) : null;

  /* Tailles : <input type="radio" name="size" value="L|Xl|2xl|3xl"> — on
     normalise en majuscules et on dédoublonne. */
  const sizes = fromJson?.sizes ? [...fromJson.sizes] : [];
  if (sizes.length === 0) {
    doc.querySelectorAll('input[name="size"]').forEach(el => {
      const v = (el.value || '').toUpperCase().trim();
      if (v && !sizes.includes(v)) sizes.push(v);
    });
  }
  if (sizes.length === 0) {
    const section = html.match(/Choisir la taille[\s\S]{0,3000}?(?:Choisir la couleur|$)/i)?.[0] || html;
    (section.match(/value=["'](xs|s|m|l|x{1,3}l|[2-6]\s?xl)["']/gi) || []).forEach(m => {
      const v = m.replace(/value=["']|["']/gi, '').toUpperCase().trim();
      if (v && !sizes.includes(v)) sizes.push(v);
    });
  }

  /* Couleurs : <button class="color-button" data-color="38"
       style="background-color:#000000"> avec le nom dans le title du parent
       (<div title="Noir">) ou un <span> voisin. L'id data-color est celui
       envoyé comme color_id à la commande. */
  const colors = fromJson?.colors ? [...fromJson.colors] : [];
  if (colors.length === 0) {
    doc.querySelectorAll('button.color-button, [data-color], input[name="color"], [data-color-id]').forEach(el => {
      const id = el.getAttribute('data-color') || el.getAttribute('data-color-id') || el.value;
      if (!id) return;
      let label = el.closest('[title]')?.getAttribute('title')
        || el.getAttribute('title') || el.getAttribute('data-color-name') || '';
      if (!label) label = el.parentElement?.querySelector('span')?.textContent?.trim() || '';
      const bg = el.style?.backgroundColor
        || el.getAttribute('style')?.match(/background(?:-color)?\s*:\s*([^;"']+)/i)?.[1]?.trim() || '';
      if (!colors.some(c => c.id === String(id))) {
        colors.push({ id: String(id), label: label || colorNameFromCss(bg), bg });
      }
    });
  }
  if (colors.length === 0) {
    /* Repli texte : bloc « data-color="NN" ... background-color:#hex ... title/Noir » */
    const re = /data-color=["'](\d+)["'][^>]*style=["'][^"']*background(?:-color)?\s*:\s*([^;"']+)/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      if (!colors.some(c => c.id === m[1])) colors.push({ id: m[1], label: colorNameFromCss(m[2].trim()), bg: m[2].trim() });
    }
  }

  const cities = fromJson?.cities ? [...fromJson.cities] : [];
  const villeSelect = doc.querySelector('select[name="ville"], #ville');
  if (cities.length === 0 && villeSelect) {
    villeSelect.querySelectorAll('option').forEach(opt => {
      const val = opt.value;
      const text = opt.textContent?.trim();
      if (val && text && val !== '') cities.push({ id: val, name: text });
    });
  }

  const images = fromJson?.images ? [...fromJson.images] : [];
  if (images.length === 0) doc.querySelectorAll('.product-gallery img, .swiper img, .carousel img, [class*="slider"] img, [class*="gallery"] img').forEach(img => {
    const src = img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('src') || '';
    const fullSrc = src.startsWith('//') ? `https:${src}` : src.startsWith('/') ? `https://www.chic-affiliate.com${src}` : src;
    if (fullSrc && fullSrc.includes('http') && !images.includes(fullSrc)) images.push(fullSrc);
  });
  if (images.length === 0) {
    const imgRegex = /src="(https?:\/\/[^"]*(?:product_photos|uploads)[^"]*)"/g;
    let im;
    while ((im = imgRegex.exec(html)) !== null) {
      if (!images.includes(im[1])) images.push(im[1]);
    }
  }

  const descEl = doc.querySelector('.description, [class*="description"], .product-description');
  const description = fromJson?.description || descEl?.textContent?.trim() || '';

  const proxyImages = images.map(u => u.startsWith('/api/') ? u : `/api/chic-image?url=${encodeURIComponent(u)}`);

  return {
    token, productId: fromJson?.productId || productId,
    sizes, colors, cities, images: proxyImages, description,
    _diag: { inertiaFound: !!inertia, jsonSizes: fromJson?.sizes?.length || 0, jsonColors: fromJson?.colors?.length || 0, jsonImages: fromJson?.images?.length || 0 },
  };
}

/* Diagnostic : renvoie ce que le parseur voit réellement sur la page produit
   (JSON Inertia présent ? clés de haut niveau ? extrait HTML autour de taille
   et couleur) pour corriger le parsing si des variantes manquent encore. */
export async function diagnoseChicProduct(chicProductId) {
  const res = await fetch(proxyUrl(`/affiliate/products/${chicProductId}`, 'html'));
  if (res.status === 401) { flagSession(res); throw new Error('Session Chic expirée — reconnectez-vous'); }
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  const { html } = await res.json();
  const inertia = extractInertiaData(html);
  const harvested = inertia ? harvestProduct(inertia) : null;
  const topKeys = inertia?.props ? Object.keys(inertia.props) : (inertia ? Object.keys(inertia) : []);
  const around = (kw, len = 1400) => {
    const i = html.toLowerCase().indexOf(kw.toLowerCase());
    return i < 0 ? '(absent)' : html.slice(i, i + len).replace(/\s+/g, ' ');
  };
  return {
    htmlLength: html.length,
    inertiaFound: !!inertia,
    topLevelKeys: topKeys,
    harvested: harvested && { sizes: harvested.sizes, colors: harvested.colors.map(c => `${c.id}:${c.label || c.bg}`), images: harvested.images.length, cities: harvested.cities.length },
    htmlAroundTaille: around('choisir la taille'),
    htmlAroundCouleur: around('choisir la couleur'),
  };
}

export async function createChicOrder(orderData) {
  const {
    token, productId, size, color, quantity,
    recipientPrice, recipient, phone,
    villeId, fraisLivraison, address, comment,
  } = orderData;

  const body = new URLSearchParams({
    _token: token,
    product_id: productId,
    size: size || '',
    color: color || '',
    quantity: String(quantity || 1),
    recipient_price: String(recipientPrice || ''),
    recipient: recipient || '',
    recipient_phone: phone || '',
    ville: villeId || '',
    ville_id: villeId || '',
    frais_livraison: String(fraisLivraison || ''),
    shipping_address: address || '',
    comment: comment || '',
    frais_retour: '',
    frais_refus: '',
  });

  const res = await fetch(proxyUrl('/affiliate/orders/store'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (res.status === 401) { flagSession(res); throw new Error('Session Chic expirée — reconnectez-vous'); }
  const data = await res.json();
  if (data.success) return data;
  if (data.error) { if (isSessionError({ message: data.error })) flagSession({ status: 401 }); throw new Error(data.error); }
  throw new Error('Erreur lors de la création de la commande');
}

/* ── API officielle (Clé CHIC_...) ──
   Appelle un chemin /api/... de chic-affiliate.com avec la clé API du profil. */
export async function chicApi(path, { method = 'GET', body, host, auth, keyOverride } = {}) {
  const config = getChicConfig();
  const key = (keyOverride || config?.apiKey || '').trim();
  if (!key) throw new Error('Clé API non configurée');
  const params = new URLSearchParams({ path });
  if (host) params.set('host', host);
  if (auth) params.set('auth', auth);
  const opts = { method, headers: { 'x-chic-key': key } };
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch(`/api/chic-api?${params}`, opts);
  return res.json();
}

/* Sonde les endpoints réels de l'API Chic (non documentée publiquement —
   utilisée par urlanding). Phase 1 : trouver la combinaison host + méthode
   d'authentification que /api/user accepte. Phase 2 : sonder les chemins
   candidats avec la meilleure combinaison. */
export async function discoverChicApi(onProgress) {
  const results = [];
  const hosts = ['www.chic-affiliate.com', 'api.chic-affiliate.com'];
  const auths = ['bearer', 'xkey', 'plain', 'query'];

  /* Phase 1 — /api/user est la seule route confirmée (401 = existe).
     urlanding stocke la clé SANS le préfixe « CHIC_ » : on teste les deux
     formes de la clé pour chaque combinaison host × méthode d'auth. */
  const rawKey = (getChicConfig()?.apiKey || '').trim();
  const keyForms = [...new Set([rawKey, rawKey.replace(/^CHIC_/i, ''), rawKey.startsWith('CHIC_') ? rawKey : `CHIC_${rawKey}`])].filter(Boolean);
  let best = null;
  for (const keyOverride of keyForms) {
    const kLabel = keyOverride.startsWith('CHIC_') ? 'avec CHIC_' : 'sans CHIC_';
    for (const host of hosts) {
      for (const auth of auths) {
        onProgress?.(`auth: ${host} / ${auth} / ${kLabel}`);
        try {
          const r = await chicApi('/api/user', { host, auth, keyOverride });
          results.push({ path: `[${host} · ${auth} · ${kLabel}] /api/user`, status: r.status, sample: JSON.stringify(r.body).slice(0, 180) });
          if (r.status >= 200 && r.status < 300 && !best) best = { host, auth, keyOverride };
        } catch (e) {
          results.push({ path: `[${host} · ${auth} · ${kLabel}] /api/user`, status: 0, sample: e.message });
        }
      }
    }
    if (best) break;
  }

  /* Phase 2 — chemins candidats (y compris ceux propres à urlanding) */
  const candidates = [
    '/api/products', '/api/orders', '/api/cities',
    '/api/urlanding/products', '/api/urlanding/orders', '/api/urlanding/user',
    '/api/landing/products', '/api/landing/orders',
    '/api/external/products', '/api/external/orders', '/api/external/order',
    '/api/integration/products', '/api/integration/orders',
    '/api/affiliate/user', '/api/v2/products', '/api/store/order',
    '/api/orders/create', '/api/order', '/api/product/list', '/api/orders/list',
  ];
  const combo = best || { host: 'www.chic-affiliate.com', auth: 'bearer' };
  for (const path of candidates) {
    onProgress?.(path);
    try {
      const r = await chicApi(path, combo);
      results.push({ path: `[${combo.host} · ${combo.auth}] ${path}`, status: r.status, sample: JSON.stringify(r.body).slice(0, 180) });
    } catch (e) {
      results.push({ path, status: 0, sample: e.message });
    }
  }
  return results;
}

export async function fetchChicCounts() {
  const params = new URLSearchParams({
    draw: '1',
    start: '0',
    length: '1',
    'columns[0][data]': 'id',
    'columns[0][searchable]': 'true',
    'order[0][column]': '0',
    'order[0][dir]': 'desc',
  });
  const res = await fetch(proxyUrl(`/affiliate/orders/dataTables?${params}`));
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  const data = await res.json();
  return { total: data.recordsTotal || 0 };
}
