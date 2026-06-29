function getWooKeys() {
  try {
    const cfg = JSON.parse(localStorage.getItem('woo_config') || '{}');
    return {
      ck: cfg.consumerKey || import.meta.env.VITE_WOO_CONSUMER_KEY || '',
      cs: cfg.consumerSecret || import.meta.env.VITE_WOO_CONSUMER_SECRET || '',
    };
  } catch {
    return { ck: import.meta.env.VITE_WOO_CONSUMER_KEY || '', cs: import.meta.env.VITE_WOO_CONSUMER_SECRET || '' };
  }
}

const WOO_BASE = '/wc-api/wp-json/wc/v3';

function wooHeaders() {
  const { ck, cs } = getWooKeys();
  return { Authorization: 'Basic ' + btoa(`${ck}:${cs}`) };
}

function wooUrl(path, extra = {}) {
  const params = new URLSearchParams(extra);
  const qs = params.toString();
  return `${WOO_BASE}${path}${qs ? '?' + qs : ''}`;
}

async function fetchAllWooProducts() {
  let all = [];
  let page = 1;
  while (true) {
    const res = await fetch(wooUrl('/products', { per_page: 100, page, status: 'any' }), { headers: wooHeaders() });
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
  const res = await fetch(wooUrl(`/products/${productId}/variations`, { per_page: 100 }), { headers: wooHeaders() });
  if (!res.ok) return [];
  return res.json();
}

function mapWooProduct(wooProduct, variations) {
  const vars = variations.length > 0
    ? variations.map(v => ({
        wooVarId: v.id,
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

export async function updateWooStock(wooProductId, variationId, newStock) {
  const { ck, cs } = getWooKeys();
  if (!ck || !cs || !wooProductId) return;
  try {
    const path = variationId
      ? `/products/${wooProductId}/variations/${variationId}`
      : `/products/${wooProductId}`;
    const res = await fetch(wooUrl(path), {
      method: 'PUT',
      headers: { ...wooHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock_quantity: newStock, manage_stock: true }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[woo] stock update failed:', err.message || res.status);
    }
  } catch (e) {
    console.error('[woo] stock update error:', e?.message);
  }
}

export async function pushProductToWoo(product) {
  const { ck, cs } = getWooKeys();
  if (!ck || !cs) throw new Error('WooCommerce non configuré — allez dans Paramètres');

  const variations = (product.variations || []).filter(v => v.taille && v.taille !== '?');
  const isVariable = variations.length > 1;

  const body = {
    name: product.name,
    type: isVariable ? 'variable' : 'simple',
    status: product.statut === 'Active' ? 'publish' : 'draft',
    regular_price: isVariable ? undefined : String(product.compareAt || product.prix || 0),
    sale_price: isVariable ? undefined : String(product.prix || 0),
    manage_stock: !isVariable,
    stock_quantity: isVariable ? undefined : (variations[0]?.stock || 0),
    sku: product.ref || '',
  };

  if (product.image) {
    const imgSrc = product.image.startsWith('data:') ? undefined : product.image;
    if (imgSrc) body.images = [{ src: imgSrc }];
  }

  if (isVariable) {
    body.attributes = [{
      name: 'Taille',
      position: 0,
      visible: true,
      variation: true,
      options: variations.map(v => v.taille),
    }];
  }

  const res = await fetch(wooUrl('/products'), {
    method: 'POST',
    headers: { ...wooHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Erreur WooCommerce ${res.status}`);
  }

  const created = await res.json();

  if (isVariable) {
    const varBatch = variations.map(v => ({
      regular_price: String(v.compareAt || v.prix || 0),
      sale_price: String(v.prix || 0),
      manage_stock: true,
      stock_quantity: v.stock || 0,
      attributes: [{ name: 'Taille', option: v.taille }],
    }));

    const batchRes = await fetch(wooUrl(`/products/${created.id}/variations/batch`), {
      method: 'POST',
      headers: { ...wooHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ create: varBatch }),
    });

    if (!batchRes.ok) {
      const err = await batchRes.json().catch(() => ({}));
      console.error('[woo] variations batch error:', err);
    }
  }

  return created;
}

export async function importProductsFromWooCommerce(onProgress) {
  const { ck, cs } = getWooKeys();
  if (!ck || !cs) {
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
