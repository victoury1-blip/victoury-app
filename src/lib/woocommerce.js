const CK = import.meta.env.VITE_WOO_CONSUMER_KEY || 'ck_80002f30dc327e073f38b771ce6484879ff2e0e3';
const CS = import.meta.env.VITE_WOO_CONSUMER_SECRET || 'cs_df9e68224d3139159b19a803981ef820a4a06ceb';

const WOO_BASE = '/wc-api/wp-json/wc/v3';

function wooUrl(path, extra = {}) {
  const params = new URLSearchParams({ consumer_key: CK, consumer_secret: CS, ...extra });
  return `${WOO_BASE}${path}?${params}`;
}

async function fetchAllWooProducts() {
  let all = [];
  let page = 1;
  while (true) {
    const res = await fetch(wooUrl('/products', { per_page: 100, page, status: 'any' }));
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!data.length) break;
    all = [...all, ...data];
    if (data.length < 100) break;
    page++;
  }
  return all;
}

async function fetchWooVariations(productId) {
  const res = await fetch(wooUrl(`/products/${productId}/variations`, { per_page: 100 }));
  if (!res.ok) return [];
  return res.json();
}

function mapWooProduct(wooProduct, variations) {
  const vars = variations.length > 0
    ? variations.map(v => ({
        taille: v.attributes?.[0]?.option || 'N/A',
        stock: v.stock_quantity ?? 0,
        prix: parseFloat(v.regular_price) || parseFloat(wooProduct.regular_price) || 0,
        compareAt: parseFloat(v.sale_price) || parseFloat(wooProduct.sale_price) || 0,
        ajust: 0,
      }))
    : [{
        taille: 'Default',
        stock: wooProduct.stock_quantity ?? 0,
        prix: parseFloat(wooProduct.regular_price) || 0,
        compareAt: parseFloat(wooProduct.sale_price) || 0,
        ajust: 0,
      }];

  return {
    id: Date.now() + Math.floor(Math.random() * 10000),
    wooId: wooProduct.id,
    ref: wooProduct.sku || '',
    name: wooProduct.name,
    image: wooProduct.images?.[0]?.src || null,
    statut: wooProduct.status === 'publish' ? 'Active' : 'Draft',
    boutique: 'WooCommerce',
    shopifyId: '',
    prix: parseFloat(wooProduct.regular_price) || 0,
    compareAt: parseFloat(wooProduct.sale_price) || 0,
    etiquette: wooProduct.tags?.map(t => t.name).join(', ') || '',
    sizeType: 'alpha',
    variations: vars,
  };
}

export async function importProductsFromWooCommerce(onProgress) {
  if (!CK || !CS) {
    return { success: false, error: 'WooCommerce non configuré' };
  }

  try {
    onProgress?.('Récupération des produits WooCommerce...');
    const wooProducts = await fetchAllWooProducts();

    const imported = [];
    for (let i = 0; i < wooProducts.length; i++) {
      const wp = wooProducts[i];
      onProgress?.(`Traitement ${i + 1}/${wooProducts.length}: ${wp.name}`);
      let variations = [];
      if (wp.type === 'variable') {
        variations = await fetchWooVariations(wp.id);
      }
      imported.push(mapWooProduct(wp, variations));
    }

    return { success: true, products: imported };
  } catch (error) {
    console.error('WooCommerce import error:', error);
    return { success: false, error: error.message };
  }
}
