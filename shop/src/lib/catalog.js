import { supabase } from './supabase';
import { paliersEffectifs } from './remises';
import { REGLAGES_DEFAUT, PIXEL_DEFAUT, CLARITY_DEFAUT, THEME_DEFAUT, stockTaille } from './catalogDefaults';

// Réexportés pour que les fichiers qui les importaient déjà depuis ici (la
// majorité du code) n'aient rien à changer — seuls App.jsx et Accueil.jsx,
// qui doivent éviter de tirer le client Supabase dans leur chargement
// initial, les importent désormais directement depuis catalogDefaults.js.
export { REGLAGES_DEFAUT, PIXEL_DEFAUT, CLARITY_DEFAUT, THEME_DEFAUT, stockTaille };

/* Lecture du catalogue.
 *
 * Tout part du `slug` : c'est l'adresse publique d'un produit, celle que porte
 * une annonce en cours. Elle ne se déduit pas d'un identifiant interne — elle
 * est la donnée elle-même, et ne change jamais.
 */

const PRODUIT = `
  id, slug, name, description, details, price, compare_at, gender, status,
  color_name, color_hex, position, group_id, collection_id, is_bestseller,
  images:shop_product_images(url, alt, position),
  sizes:shop_product_sizes(size, stock, position)
`;

const trier = (p) => ({
  ...p,
  images: (p.images || []).sort((a, b) => a.position - b.position),
  sizes: (p.sizes || []).sort((a, b) => a.position - b.position),
});

/* Une couleur = une fiche (nécessaire pour ses propres photos et son propre
   stock), mais une GRILLE ne doit montrer qu'UNE carte par groupe — le choix
   de couleur se fait sur la fiche produit, via les pastilles. Sans ce filtre,
   un article publié en 4 couleurs occupe 4 emplacements de grille au lieu
   d'un, et noie le reste du catalogue (25 imports affichés en 54 cartes). */
const unProduitParGroupe = (produits) => {
  const vus = new Set();
  return produits.filter(p => {
    if (!p.group_id) return true;
    if (vus.has(p.group_id)) return false;
    vus.add(p.group_id);
    return true;
  });
};

export async function chargerCollections() {
  const { data, error } = await supabase
    .from('shop_collections').select('*').order('position');
  if (error) throw error;
  return data || [];
}

/** Collections avec leur nombre de produits actifs — pour la vignette
    "24 PRODUITS" affichée sous chaque catégorie sur l'accueil. */
export async function chargerCollectionsAvecCompte() {
  const [collections, { data: produits }] = await Promise.all([
    chargerCollections(),
    supabase.from('shop_products').select('collection_id').eq('status', 'Actif'),
  ]);
  const comptes = {};
  (produits || []).forEach(p => { if (p.collection_id) comptes[p.collection_id] = (comptes[p.collection_id] || 0) + 1; });
  return collections.map(c => ({ ...c, count: comptes[c.id] || 0 }));
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
    .from('shop_products').select(PRODUIT).eq('collection_id', col.id).eq('status', 'Actif').order('position');
  if (error) throw error;
  return { collection: col, produits: unProduitParGroupe((data || []).map(trier)) };
}

// Un produit archivé (vendu au moins une fois, retiré de la vente) reste en
// base pour l'historique des commandes — mais un lien direct (favoris,
// ancienne pub) ne doit plus l'ouvrir, comme s'il n'existait plus.
export async function chargerProduit(slug) {
  const { data, error } = await supabase
    .from('shop_products').select(PRODUIT).eq('slug', slug).eq('status', 'Actif').maybeSingle();
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

/** Autres produits de la même collection — pour la fiche produit, la
    suggestion la plus pertinente reste "ce qui ressemble à ce que je regarde". */
export async function chargerProduitsLies(collectionId, produitIdAExclure, limite = 4) {
  if (!collectionId) return [];
  // On rapatrie plus large que `limite` : dédoublonner par groupe APRÈS avoir
  // coupé à `limite` pourrait ne laisser que 2 cartes si les 4 premières
  // lignes étaient 4 couleurs du même article.
  const { data, error } = await supabase
    .from('shop_products').select(PRODUIT)
    .eq('collection_id', collectionId).eq('status', 'Actif').neq('id', produitIdAExclure)
    .order('position').limit(limite * 3);
  if (error) return [];
  return unProduitParGroupe((data || []).map(trier)).slice(0, limite);
}

/* Page "Mes favoris" : les produits gardés en localStorage (lib/wishlist.js)
   n'existent que par leur slug — il faut les recharger pour avoir un prix, un
   stock et une photo à jour (un article ajouté aux favoris peut très bien
   avoir changé de prix, ou disparu, depuis). */
export async function chargerProduitsParSlugs(slugs) {
  if (!slugs?.length) return [];
  const { data, error } = await supabase
    .from('shop_products').select(PRODUIT).eq('status', 'Actif').in('slug', slugs);
  if (error) return [];
  // L'ordre d'ajout aux favoris (le plus récent en premier) se perd dans la
  // réponse Supabase — on le restitue depuis l'ordre du tableau reçu en entrée.
  const parSlug = new Map((data || []).map(trier).map(p => [p.slug, p]));
  return slugs.map(s => parSlug.get(s)).filter(Boolean);
}

export async function chargerNouveautes(limite = 8) {
  const { data, error } = await supabase
    .from('shop_products').select(PRODUIT).eq('status', 'Actif').order('created_at', { ascending: false }).limit(limite * 3);
  if (error) throw error;
  return unProduitParGroupe((data || []).map(trier)).slice(0, limite);
}

/* Suggestions du panier : des articles de la MÊME collection que ce qui est
   déjà dans le panier plutôt que des nouveautés au hasard — proposer une robe
   à qui a un ensemble de sport dans son panier n'aide pas à profiter d'un
   palier de remise par quantité, qui se calcule justement par collection. */
export async function chargerProduitsParCollections(collectionIds, limite = 8) {
  if (!collectionIds?.length) return [];
  const { data, error } = await supabase
    .from('shop_products').select(PRODUIT).eq('status', 'Actif')
    .in('collection_id', collectionIds).order('created_at', { ascending: false }).limit(limite * 3);
  if (error) throw error;
  return unProduitParGroupe((data || []).map(trier)).slice(0, limite);
}

/* Avis clients : captures d'écran de conversations WhatsApp ou de messages
   de clientes satisfaites, déposées telles quelles depuis /store/avis — pas
   un système de notation, juste une preuve sociale que l'admin choisit. */
export async function chargerAvis() {
  const { data } = await supabase.from('shop_settings').select('value').eq('key', 'avis').maybeSingle();
  return Array.isArray(data?.value) ? data.value : [];
}

export async function chargerPage(slug) {
  const { data, error } = await supabase
    .from('shop_pages').select('*').eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function chargerReglages() {
  const { data, error } = await supabase.from('shop_settings').select('key, value');
  if (error) return { ...REGLAGES_DEFAUT, pixel: { ...PIXEL_DEFAUT }, theme: { ...THEME_DEFAUT }, clarity: { ...CLARITY_DEFAUT } };
  const map = Object.fromEntries((data || []).map(r => [r.key, r.value]));
  const themeSauve = map.theme || {};
  const remises = Array.isArray(map.remises) ? map.remises : [];
  return {
    ...REGLAGES_DEFAUT, ...(map.boutique || {}),
    // Plusieurs remises nommées peuvent exister (/store/remises) ; seules
    // celles activées comptent, et c'est leur fusion qui s'applique au panier.
    // Ici, seules les règles globales (sans collection ciblée) — le panier
    // peut mélanger plusieurs collections, jamais réduit à une seule.
    paliers: remises.length ? paliersEffectifs(remises) : (map.boutique?.paliers || []),
    // Bruts, pour qu'une fiche produit calcule la remise propre à SA
    // collection (règles globales + celles ciblant justement cette collection).
    remises,
    pixel: { ...PIXEL_DEFAUT, ...(map.meta_pixel || {}) },
    clarity: { ...CLARITY_DEFAUT, ...(map.microsoft_clarity || {}) },
    theme: {
      ...THEME_DEFAUT, ...themeSauve,
      hero: { ...THEME_DEFAUT.hero, ...(themeSauve.hero || {}) },
      texteSousHero: { ...THEME_DEFAUT.texteSousHero, ...(themeSauve.texteSousHero || {}) },
      guideTailles: { ...THEME_DEFAUT.guideTailles, ...(themeSauve.guideTailles || {}) },
      sectionVedette: { ...THEME_DEFAUT.sectionVedette, ...(themeSauve.sectionVedette || {}) },
      footer: {
        ...THEME_DEFAUT.footer, ...(themeSauve.footer || {}),
        paiement: { ...THEME_DEFAUT.footer.paiement, ...(themeSauve.footer?.paiement || {}) },
        contacts: { ...THEME_DEFAUT.footer.contacts, ...(themeSauve.footer?.contacts || {}) },
      },
    },
  };
}

/** Vérifie un code promo sans jamais exposer la liste des codes. */
export async function verifierPromo(code, total) {
  const { data, error } = await supabase.rpc('shop_check_promo', { p_code: code, p_total: total });
  if (error || !data?.length) return null;
  return data[0];
}
