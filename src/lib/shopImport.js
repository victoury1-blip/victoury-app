import { supabase } from './supabase';

/* Récupère les produits déposés dans la boutique en ligne (shop_products,
   même projet Supabase que l'admin — voir CLAUDE.md) et les met à la même
   forme que mapWooProduct (voir woocommerce.js), pour qu'ils s'affichent et
   se gèrent dans le Stock exactement comme un produit WooCommerce. Sert à
   remplacer la synchro WooCommerce quand le stock est piloté depuis le
   catalogue de la boutique elle-même, plutôt que depuis WooCommerce. */
export async function importProductsFromShop() {
  try {
    const { data, error } = await supabase
      .from('shop_products')
      .select(`
        id, slug, name, price, compare_at, status,
        images:shop_product_images(url, position),
        sizes:shop_product_sizes(size, stock, position)
      `);
    if (error) throw error;

    const imported = (data || []).map(p => {
      const images = (p.images || []).sort((a, b) => a.position - b.position);
      const sizes = (p.sizes || []).sort((a, b) => a.position - b.position);
      const variations = sizes.length > 0
        ? sizes.map(s => ({
            taille: s.size || 'N/A',
            stock: s.stock ?? 0,
            prix: p.price || 0,
            compareAt: p.compare_at || 0,
            ajust: 0,
          }))
        : [{ taille: 'Default', stock: 0, prix: p.price || 0, compareAt: p.compare_at || 0, ajust: 0 }];

      return {
        id: Date.now() + Math.floor(Math.random() * 10000),
        shopProductId: p.id,
        ref: p.slug || '',
        name: p.name,
        image: images[0]?.url || null,
        statut: p.status === 'Actif' ? 'Active' : 'Draft',
        boutique: 'Shop',
        shopifyId: '',
        prix: p.price || 0,
        compareAt: p.compare_at || 0,
        etiquette: '',
        sizeType: 'alpha',
        variations,
      };
    });

    return { success: true, products: imported };
  } catch (error) {
    console.error('Shop import error:', error);
    return { success: false, error: error.message };
  }
}
