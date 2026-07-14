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
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  return res.json();
}

export async function fetchChicProducts() {
  const res = await fetch(proxyUrl('/affiliate/products', 'html'));
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  const { html } = await res.json();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const products = [];
  const cards = doc.querySelectorAll('.card, .product-card, [class*="product"]');
  if (cards.length > 0) {
    cards.forEach(card => {
      const name = card.querySelector('h5, h4, h3, .product-name, .card-title')?.textContent?.trim() || '';
      const texts = card.textContent || '';
      const prices = texts.match(/[\d,.]+\s*MAD/g) || [];
      const imgEl = card.querySelector('img');
      const img = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('data-lazy-src') || imgEl?.getAttribute('data-original') || imgEl?.getAttribute('src') || '';
      const rawImg = img.startsWith('//') ? `https:${img}` : img.startsWith('/') ? `https://www.chic-affiliate.com${img}` : img;
      const proxyImg = rawImg ? `/api/chic-image?url=${encodeURIComponent(rawImg)}` : '';
      const link = card.querySelector('a[href*="/affiliate/products/"]');
      const href = link?.getAttribute('href') || '';
      const chicId = href.match(/\/products\/(\d+)/)?.[1] || '';
      if (name) {
        products.push({
          name,
          chicId,
          salePrice: prices[0] || '',
          resellerPrice: prices[1] || '',
          image: proxyImg,
        });
      }
    });
  }
  if (products.length === 0) {
    const allText = doc.body?.innerHTML || '';
    return { data: [], recordsTotal: 0, html: allText.slice(0, 2000) };
  }
  return { data: products, recordsTotal: products.length };
}

export async function fetchChicProductDetails(chicProductId) {
  const res = await fetch(proxyUrl(`/affiliate/products/${chicProductId}`, 'html'));
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  const { html } = await res.json();
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const token = doc.querySelector('input[name="_token"]')?.value || '';
  const productId = doc.querySelector('input[name="product_id"]')?.value || chicProductId;

  const sizes = [];
  doc.querySelectorAll('input[name="size"], button[data-size], .size-option').forEach(el => {
    const val = el.value || el.getAttribute('data-size') || el.textContent?.trim();
    if (val) sizes.push(val);
  });
  if (sizes.length === 0) {
    /* Le site affiche les tailles en casse mixte (« Xl », « 2xl », « 3xl ») :
       la détection doit être insensible à la casse, sinon on retombe sur des
       tailles par défaut fausses (S/M/L/XL). */
    const section = html.match(/Choisir la taille[\s\S]{0,3000}?(?:Choisir la couleur|$)/i)?.[0] || html;
    const sizeMatches = section.match(/>\s*(xs|s|m|l|x{1,3}l|[2-6]\s?xl)\s*</gi) || [];
    sizeMatches.forEach(m => {
      const v = m.replace(/[<>\s]/g, '').toUpperCase();
      if (v && !sizes.includes(v)) sizes.push(v);
    });
  }

  const colors = [];
  doc.querySelectorAll('input[name="color"], [data-color-id]').forEach(el => {
    const id = el.value || el.getAttribute('data-color-id');
    const label = el.getAttribute('title') || el.getAttribute('data-color-name') || '';
    /* La pastille (fond coloré) peut être sur l'input, son label parent ou un
       élément voisin — on cherche le premier style background disponible. */
    let bg = el.style?.backgroundColor || el.getAttribute('data-color') || '';
    if (!bg) {
      const holder = el.closest('label') || el.parentElement;
      const swatch = holder?.querySelector('[style*="background"]') || (holder?.getAttribute('style')?.includes('background') ? holder : null);
      bg = swatch?.getAttribute('style')?.match(/background(?:-color)?\s*:\s*([^;"']+)/i)?.[1]?.trim() || '';
    }
    if (id) colors.push({ id, label: label || colorNameFromCss(bg), bg });
  });
  if (colors.length === 0) {
    const colorRegex = /name="color"[^>]*value="(\d+)"/g;
    let m;
    while ((m = colorRegex.exec(html)) !== null) {
      /* Style inline proche de l'input (dans les 300 caractères suivants) */
      const around = html.slice(m.index, m.index + 300);
      const bg = around.match(/background(?:-color)?\s*:\s*([^;"']+)/i)?.[1]?.trim() || '';
      colors.push({ id: m[1], label: colorNameFromCss(bg), bg });
    }
    if (colors.length === 0) {
      const colorMatch = html.match(/color.*?value="(\d+)"/i);
      if (colorMatch) colors.push({ id: colorMatch[1], label: '', bg: '' });
    }
  }

  const cities = [];
  const villeSelect = doc.querySelector('select[name="ville"], #ville');
  if (villeSelect) {
    villeSelect.querySelectorAll('option').forEach(opt => {
      const val = opt.value;
      const text = opt.textContent?.trim();
      if (val && text && val !== '') cities.push({ id: val, name: text });
    });
  }

  const images = [];
  doc.querySelectorAll('.product-gallery img, .swiper img, .carousel img, [class*="slider"] img, [class*="gallery"] img').forEach(img => {
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
  const description = descEl?.textContent?.trim() || '';

  const proxyImages = images.map(u => `/api/chic-image?url=${encodeURIComponent(u)}`);

  return { token, productId, sizes, colors, cities, images: proxyImages, description };
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

  const data = await res.json();
  if (data.success) return data;
  if (data.error) throw new Error(data.error);
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
