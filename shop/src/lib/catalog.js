import { supabase } from './supabase';

/* Lecture du catalogue.
 *
 * Tout part du `slug` : c'est l'adresse publique d'un produit, celle que porte
 * une annonce en cours. Elle ne se déduit pas d'un identifiant interne — elle
 * est la donnée elle-même, et ne change jamais.
 */

const PRODUIT = `
  id, slug, name, description, details, price, compare_at, gender, status,
  color_name, color_hex, position, group_id, collection_id,
  images:shop_product_images(url, alt, position),
  sizes:shop_product_sizes(size, stock, position)
`;

const trier = (p) => ({
  ...p,
  images: (p.images || []).sort((a, b) => a.position - b.position),
  sizes: (p.sizes || []).sort((a, b) => a.position - b.position),
});

export async function chargerCollections() {
  const { data, error } = await supabase
    .from('shop_collections').select('*').order('position');
  if (error) throw error;
  return data || [];
}

export async function chargerCollection(slug) {
  const { data, error } = await supabase
    .from('shop_collections').select('*').eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function chargerProduitsDeCollection(slug) {
  const col = await chargerCollection(slug);
  if (!col) return { collection: null, produits: [] };
  const { data, error } = await supabase
    .from('shop_products').select(PRODUIT).eq('collection_id', col.id).order('position');
  if (error) throw error;
  return { collection: col, produits: (data || []).map(trier) };
}

export async function chargerProduit(slug) {
  const { data, error } = await supabase
    .from('shop_products').select(PRODUIT).eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data ? trier(data) : null;
}

/* Les autres couleurs du même modèle. Chaque couleur est un produit à part —
   c'est ainsi qu'elle est photographiée et vendue — et le groupe les relie
   pour que la fiche affiche les pastilles. */
export async function chargerCouleurs(groupId) {
  if (!groupId) return [];
  const { data, error } = await supabase
    .from('shop_products')
    .select('id, slug, name, color_name, color_hex, price, images:shop_product_images(url, position)')
    .eq('group_id', groupId).order('position');
  if (error) throw error;
  return (data || []).map(p => ({ ...p, images: (p.images || []).sort((a, b) => a.position - b.position) }));
}

export async function chargerNouveautes(limite = 8) {
  const { data, error } = await supabase
    .from('shop_products').select(PRODUIT).order('created_at', { ascending: false }).limit(limite);
  if (error) throw error;
  return (data || []).map(trier);
}

export async function chargerPage(slug) {
  const { data, error } = await supabase
    .from('shop_pages').select('*').eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data || null;
}

/* Réglages de la boutique — bandeau, remises, livraison, pixel. Un défaut est
   toujours rendu : une boutique sans réglage doit rester vendable. */
export const REGLAGES_DEFAUT = {
  annonce: 'Livraison partout au Maroc · Paiement à la livraison',
  paliers: [],
  livraison: 0,
  pixelId: '',
  telephone: '',
};

export async function chargerReglages() {
  const { data, error } = await supabase.from('shop_settings').select('key, value');
  if (error) return { ...REGLAGES_DEFAUT };
  const map = Object.fromEntries((data || []).map(r => [r.key, r.value]));
  return { ...REGLAGES_DEFAUT, ...(map.boutique || {}) };
}

/** Vérifie un code promo sans jamais exposer la liste des codes. */
export async function verifierPromo(code, total) {
  const { data, error } = await supabase.rpc('shop_check_promo', { p_code: code, p_total: total });
  if (error || !data?.length) return null;
  return data[0];
}

/** Stock disponible d'une taille — 0 quand la taille n'existe plus. */
export const stockTaille = (produit, taille) =>
  produit?.sizes?.find(s => s.size === taille)?.stock ?? 0;
