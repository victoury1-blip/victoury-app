import { colorNameFromCss } from './chicAffiliate';

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

export async function deleteWooProduct(wooProductId) {
  const { ck, cs } = getWooKeys();
  if (!ck || !cs || !wooProductId) return;
  try {
    const res = await fetch(wooUrl(`/products/${wooProductId}`, { force: true }), {
      method: 'DELETE',
      headers: wooHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[woo] delete failed:', err.message || res.status);
    }
  } catch (e) {
    console.error('[woo] delete error:', e?.message);
  }
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
    sku: '',
  };

  function resolveImg(url) {
    if (!url || url.startsWith('data:')) return null;
    let original = url;
    if (url.includes('/api/chic-image?url=')) {
      const match = url.match(/[?&]url=([^&]+)/);
      original = match ? decodeURIComponent(match[1]) : null;
    }
    if (!original) return null;
    /* Images Chic : WordPress refuse de télécharger une URL sans extension
       dans le chemin, et chic-affiliate.com bloque le hotlink sans Referer.
       On passe donc par notre proxy à chemin propre : /api/img/<b64>.jpg */
    if (original.includes('chic-affiliate.com')) {
      try {
        const b64 = btoa(original).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        const ext = (original.match(/\.(jpe?g|png|webp|gif)(?:\?|$)/i)?.[1] || 'jpg').toLowerCase();
        return `${window.location.origin}/api/img/${b64}.${ext}`;
      } catch { return original; }
    }
    return original;
  }

  const allImages = (product.images || (product.image ? [product.image] : []))
    .map(resolveImg).filter(Boolean);
  if (allImages.length > 0) body.images = allImages.map(src => ({ src }));

  if (product.description) body.description = product.description;

  /* Couleurs (produits Chic Affiliate) : deviennent un attribut de variation
     pour que le site propose taille ET couleur, comme sur chic-affiliate.com.
     Les pastilles Chic n'ont souvent pas de libellé : on déduit le nom du fond
     CSS, sinon « Couleur N » — une couleur sans nom ne doit pas disparaître. */
  const colorOpts = [...new Set((product.colors || []).map((c, i) =>
    (c.label || '').trim() || colorNameFromCss(c.bg) || `Couleur ${i + 1}`
  ))];

  if (isVariable) {
    body.attributes = [{
      name: 'Taille',
      position: 0,
      visible: true,
      variation: true,
      options: variations.map(v => v.taille),
    }];
    if (colorOpts.length > 0) {
      body.attributes.push({
        name: 'Couleur',
        position: 1,
        visible: true,
        variation: true,
        options: colorOpts,
      });
    }
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
    /* Avec couleurs : une variation par combinaison taille × couleur. */
    const varBatch = variations.flatMap(v => {
      const base = {
        regular_price: String(v.compareAt || v.prix || 0),
        sale_price: String(v.prix || 0),
        manage_stock: true,
        stock_quantity: v.stock || 0,
      };
      if (colorOpts.length === 0) {
        return [{ ...base, attributes: [{ name: 'Taille', option: v.taille }] }];
      }
      return colorOpts.map(color => ({
        ...base,
        attributes: [{ name: 'Taille', option: v.taille }, { name: 'Couleur', option: color }],
      }));
    });

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
