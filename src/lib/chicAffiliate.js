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
      const cleanImg = img.startsWith('//') ? `https:${img}` : img.startsWith('/') ? `https://www.chic-affiliate.com${img}` : img;
      if (name) {
        products.push({
          name,
          salePrice: prices[0] || '',
          resellerPrice: prices[1] || '',
          image: cleanImg,
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
