/* Import ponctuel du catalogue depuis l'ancien WooCommerce (victoury-maroc.com).
 *
 * Le relais /wc-api (voir vercel.json) évite le CORS d'un appel direct au
 * site WordPress. Les identifiants (Consumer Key/Secret) ne sont jamais
 * enregistrés : ils vivent seulement dans l'état de la page le temps de
 * l'import, comme dans l'application principale.
 */

const WOO_BASE = '/wc-api/wp-json/wc/v3';

function enTeteAuth(ck, cs) {
  return { Authorization: 'Basic ' + btoa(`${ck}:${cs}`) };
}

async function appelWoo(chemin, ck, cs) {
  const res = await fetch(`${WOO_BASE}${chemin}`, { headers: enTeteAuth(ck, cs) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Erreur WooCommerce ${res.status}`);
  }
  return res.json();
}

export async function trouverCategorieWoo(slug, ck, cs) {
  const data = await appelWoo(`/products/categories?slug=${encodeURIComponent(slug)}`, ck, cs);
  return data[0] || null;
}

async function recupererTousLesProduits(categoryId, ck, cs) {
  let tous = [];
  let page = 1;
  while (true) {
    const data = await appelWoo(`/products?category=${categoryId}&per_page=100&page=${page}&status=publish`, ck, cs);
    if (!data.length) break;
    tous = [...tous, ...data];
    if (data.length < 100) break;
    page++;
  }
  return tous;
}

const recupererVariations = (productId, ck, cs) =>
  appelWoo(`/products/${productId}/variations?per_page=100`, ck, cs).catch(() => []);

const nettoyerHtml = (html) => String(html || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/** Convertit un produit WooCommerce (+ ses variations) en la forme attendue par shop_products. */
export function mapperProduitWoo(wp, variations, collectionId) {
  const prix = parseFloat(wp.price ?? wp.regular_price) || 0;
  const compareAt = parseFloat(wp.regular_price) || 0;
  const tailles = variations.length > 0
    ? variations.map((v, i) => ({
        size: v.attributes?.[0]?.option || `Taille ${i + 1}`,
        stock: v.stock_quantity ?? (v.stock_status === 'instock' ? 1 : 0),
      }))
    : [{ size: 'Unique', stock: wp.stock_quantity ?? (wp.stock_status === 'instock' ? 1 : 0) }];

  return {
    produit: {
      slug: wp.slug,
      name: wp.name,
      description: nettoyerHtml(wp.short_description),
      details: nettoyerHtml(wp.description),
      price: prix,
      compare_at: compareAt > prix ? compareAt : null,
      status: wp.status === 'publish' ? 'Actif' : 'Inactif',
      collection_id: collectionId,
    },
    images: (wp.images || []).map(img => ({ url: img.src, alt: img.alt || '' })),
    tailles,
  };
}

/** Récupère et convertit tous les produits publiés d'une catégorie WooCommerce. */
export async function importerCategorieWoo({ categorieSlug, collectionId, consumerKey, consumerSecret, onProgress }) {
  const cat = await trouverCategorieWoo(categorieSlug, consumerKey, consumerSecret);
  if (!cat) throw new Error(`Catégorie "${categorieSlug}" introuvable sur WooCommerce`);
  onProgress?.(`Catégorie trouvée : ${cat.name} (${cat.count} produits publiés)`);

  const produits = await recupererTousLesProduits(cat.id, consumerKey, consumerSecret);
  const resultats = [];
  for (let i = 0; i < produits.length; i++) {
    const wp = produits[i];
    onProgress?.(`${i + 1}/${produits.length} — ${wp.name}`);
    const variations = wp.type === 'variable' ? await recupererVariations(wp.id, consumerKey, consumerSecret) : [];
    resultats.push(mapperProduitWoo(wp, variations, collectionId));
  }
  return resultats;
}
