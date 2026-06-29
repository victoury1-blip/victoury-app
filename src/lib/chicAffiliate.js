import { cloudSet } from './cloudSettings';

const STORAGE_KEY = 'chic_config';

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
    const sizeText = html.match(/Choisir la taille[\s\S]*?<\/div>/i)?.[0] || '';
    const sizeMatches = sizeText.match(/>(S|M|L|XL|XXL|2XL|3XL)</g);
    if (sizeMatches) sizeMatches.forEach(m => sizes.push(m.replace('>', '')));
  }

  const colors = [];
  doc.querySelectorAll('input[name="color"], [data-color-id]').forEach(el => {
    const id = el.value || el.getAttribute('data-color-id');
    const label = el.getAttribute('title') || el.getAttribute('data-color-name') || '';
    const bg = el.style?.backgroundColor || el.getAttribute('data-color') || '';
    if (id) colors.push({ id, label, bg });
  });
  if (colors.length === 0) {
    const colorRegex = /name="color"[^>]*value="(\d+)"/g;
    let m;
    while ((m = colorRegex.exec(html)) !== null) {
      colors.push({ id: m[1], label: '', bg: '' });
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
