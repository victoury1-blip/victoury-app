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

function proxyUrl(path) {
  const config = getChicConfig();
  if (!config) throw new Error('Chic Affiliate non configuré');
  const params = new URLSearchParams({ path, session: config.sessionCookie });
  if (config.xsrfToken) params.set('xsrf', config.xsrfToken);
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

export async function fetchChicProducts(start = 0, length = 50) {
  const params = new URLSearchParams({
    draw: '1',
    start: String(start),
    length: String(length),
    'columns[0][data]': 'id',
    'columns[0][searchable]': 'true',
    'order[0][column]': '0',
    'order[0][dir]': 'desc',
  });

  const res = await fetch(proxyUrl(`/affiliate/products/dataTables?${params}`));
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  return res.json();
}

export async function fetchChicCounts() {
  const res = await fetch(proxyUrl('/affiliate/orders/getCounts'));
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  return res.json();
}
