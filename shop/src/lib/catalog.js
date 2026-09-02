import { supabase } from './supabase';
import { paliersEffectifs } from './remises';

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

/* Réglages de la boutique — remises, livraison, contact. Un défaut est
   toujours rendu : une boutique sans réglage doit rester vendable. */
export const REGLAGES_DEFAUT = {
  paliers: [],
  livraison: 0,
  seuilGratuit: null,
  telephone: '',
};

// Le Meta Pixel vit dans sa propre clé : ni son activation ni son identifiant
// ne se mélangent aux réglages généraux, qui ont chacun leur propre page
// d'administration.
export const PIXEL_DEFAUT = { enabled: false, pixelId: '', testCode: '' };

/* Microsoft Clarity : enregistrements de session et cartes de chaleur.
 * L'identifiant de projet n'a rien d'un secret — c'est la même valeur que
 * n'importe qui verrait déjà dans le code source de chaque page — et peut
 * donc, contrairement au jeton d'accès de Meta, vivre sans risque dans les
 * réglages publics de la boutique. */
export const CLARITY_DEFAUT = { enabled: false, projectId: '' };

/* L'apparence de la boutique — logo, favicon, bandeau d'annonce — vit elle
   aussi à part : ce sont des réglages visuels, réglés depuis /store/theme,
   pas des règles de vente comme les remises ou la livraison. */
export const THEME_DEFAUT = {
  logoUrl: '', faviconUrl: '',
  // 'gauche' | 'centre' | 'droite' — position du logo (et, avec lui, de la
  // navigation) dans l'en-tête.
  logoPosition: 'gauche',
  // Couleur principale du site — texte, boutons, bordures actives. Une seule
  // valeur plutôt qu'un réglage par élément : c'est la teinte de la marque,
  // pas un détail à régler ailleurs pour chaque bouton séparément.
  couleurTexte: '#111111',
  annonceActive: true,
  annonces: ['Livraison partout au Maroc · Paiement à la livraison'],
  tailleAnnonce: 11,
  couleurAnnonceFond: '#111111',
  couleurAnnonceTexte: '#ffffff',

  hero: {
    imageDesktop: '/hero-victoury.jpg', imageMobile: '/hero-victoury.jpg',
    // Plusieurs diapositives possibles (2-3 photos qui défilent). Une boutique
    // qui n'en a réglé aucune retombe sur la photo unique ci-dessus.
    slides: [],
    titre: 'Bienvenue chez Victoury', sousTitre: 'Le confort au quotidien',
    boutonTexte: 'Voir la collection', boutonLien: '',
  },
  texteSousHero: { texte: '', taille: 14, couleurTexte: '#000000', couleurFond: '#f9f6f0' },

  footer: {
    description: 'Ensembles sport, burkinis et robes. Livraison partout au Maroc.',
    couleurFond: '#f7f5f2', couleurTexte: '#111111',
    collections: [], reseaux: [], mentions: [
      { label: 'Conditions générales de vente', url: '/conditions-generales-de-vente' },
      { label: 'Politique de livraison', url: '/politique-de-livraison' },
      { label: "Politique d'échange", url: '/politique-dechange' },
      { label: 'Politique de confidentialité', url: '/politique-de-confidentialite' },
    ],
    // Moyens de paiement acceptés, affichés en badges dans le footer.
    paiement: { livraison: true, virement: true },
    // Icônes de contact toujours visibles (même vides) pour que l'admin voie
    // tout de suite lesquelles restent à renseigner.
    contacts: { whatsapp: '', appel: '', instagram: '', tiktok: '', facebook: '' },
  },

  // Filtre par taille sur les pages de collection : pertinent quand une même
  // collection mélange des tailles vêtement (S…XL) et des tailles pointure —
  // sinon superflu, d'où l'option plutôt qu'un affichage forcé.
  collectionFiltreTaille: true,
  // Affichage des tailles sur la fiche produit : « grille » (celui déjà en
  // place) convient à un choix court (S…XL) ; « liste » convient mieux à un
  // choix long comme des pointures.
  produitAffichageTailles: 'grille',
};

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
    paliers: remises.length ? paliersEffectifs(remises) : (map.boutique?.paliers || []),
    pixel: { ...PIXEL_DEFAUT, ...(map.meta_pixel || {}) },
    clarity: { ...CLARITY_DEFAUT, ...(map.microsoft_clarity || {}) },
    theme: {
      ...THEME_DEFAUT, ...themeSauve,
      hero: { ...THEME_DEFAUT.hero, ...(themeSauve.hero || {}) },
      texteSousHero: { ...THEME_DEFAUT.texteSousHero, ...(themeSauve.texteSousHero || {}) },
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

/** Stock disponible d'une taille — 0 quand la taille n'existe plus. */
export const stockTaille = (produit, taille) =>
  produit?.sizes?.find(s => s.size === taille)?.stock ?? 0;
