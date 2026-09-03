import { supabase } from './supabase';
export { slugifier } from './slug';

/* Écriture du catalogue — réservée à l'administration.
 *
 * Les règles de la base l'exigent déjà : ces fonctions n'aboutissent que pour
 * un compte connecté. Le garde-fou est donc côté serveur, et non dans l'écran
 * qui les appelle.
 */

const jeter = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

/* ── Collections ── */
export const listerCollections = () =>
  supabase.from('shop_collections').select('*').order('position').then(jeter);
export const enregistrerCollection = (c) =>
  supabase.from('shop_collections').upsert(c).select().single().then(jeter);
export const supprimerCollection = (id) =>
  supabase.from('shop_collections').delete().eq('id', id).then(jeter);

// Écriture partielle (ex. juste la photo de couverture) : un update direct,
// pas d'upsert+.single() qui échouerait pour rien si la ré-sélection après
// écriture bute sur autre chose que la donnée elle-même.
export const majCollection = (id, champs) =>
  supabase.from('shop_collections').update(champs).eq('id', id).then(jeter);

/* ── Groupes (couleurs d'un même modèle) ── */
export const listerGroupes = () =>
  supabase.from('shop_groups').select('*').order('name').then(jeter);
export const enregistrerGroupe = (g) =>
  supabase.from('shop_groups').upsert(g).select().single().then(jeter);

/* ── Produits ── */
const CHAMPS = `
  id, slug, name, description, details, price, compare_at, gender, status,
  color_name, color_hex, position, group_id, collection_id, created_at,
  images:shop_product_images(id, url, alt, position),
  sizes:shop_product_sizes(id, size, stock, position)
`;

export async function listerProduits() {
  const data = await supabase.from('shop_products').select(CHAMPS).order('created_at', { ascending: false }).then(jeter);
  return (data || []).map(p => ({
    ...p,
    images: (p.images || []).sort((a, b) => a.position - b.position),
    sizes: (p.sizes || []).sort((a, b) => a.position - b.position),
  }));
}

export const enregistrerProduit = (p) =>
  supabase.from('shop_products').upsert({ ...p, updated_at: new Date().toISOString() }).select().single().then(jeter);

export const supprimerProduit = (id) =>
  supabase.from('shop_products').delete().eq('id', id).then(jeter);

// Un produit vendu doit rester traçable (commandes passées, factures) — on
// l'archive plutôt que de l'effacer. Il reste dans /store/produits (badge
// "Archivé"), mais n'apparaît plus sur la boutique (chargerProduit filtre
// sur status = 'Actif').
export const archiverProduit = (id) =>
  supabase.from('shop_products').update({ status: 'Archivé', updated_at: new Date().toISOString() }).eq('id', id).then(jeter);

// Écriture partielle générique (ex. prix en masse sur une collection) — même
// raison que majPosition : un update direct, sans .select().single().
export const majProduit = (id, champs) =>
  supabase.from('shop_products').update({ ...champs, updated_at: new Date().toISOString() }).eq('id', id).then(jeter);

/* Réordonner une collection ne touche qu'à la position — pas de .single()
   ici, qui échouerait (et ferait tout échouer avec lui) au moindre souci de
   ré-sélection après écriture, sans rien changer au résultat attendu. */
export const majPosition = (id, position) =>
  supabase.from('shop_products').update({ position, updated_at: new Date().toISOString() }).eq('id', id).then(jeter);

/* Les tailles sont remplacées en bloc : les modifier une à une laisserait, au
   moindre échec, un produit à moitié corrigé — donc du stock faux. */
export async function remplacerTailles(produitId, tailles) {
  await supabase.from('shop_product_sizes').delete().eq('product_id', produitId).then(jeter);
  const lignes = tailles
    .filter(t => String(t.size || '').trim())
    .map((t, i) => ({ product_id: produitId, size: String(t.size).trim(), stock: Number(t.stock) || 0, position: i }));
  if (!lignes.length) return [];
  return supabase.from('shop_product_sizes').insert(lignes).select().then(jeter);
}

export async function remplacerImages(produitId, images) {
  await supabase.from('shop_product_images').delete().eq('product_id', produitId).then(jeter);
  const lignes = images
    .filter(i => String(i.url || '').trim())
    .map((i, n) => ({ product_id: produitId, url: i.url.trim(), alt: i.alt || null, position: n }));
  if (!lignes.length) return [];
  return supabase.from('shop_product_images').insert(lignes).select().then(jeter);
}

/* ── Photos ── */
export async function televerserPhoto(fichier) {
  const ext = (fichier.name.split('.').pop() || 'jpg').toLowerCase();
  // Nom aléatoire : deux photos du même nom déposées le même jour s'écraseraient.
  const nom = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('boutique').upload(nom, fichier, {
    cacheControl: '31536000', upsert: false,
  });
  if (error) throw new Error(error.message);
  return supabase.storage.from('boutique').getPublicUrl(nom).data.publicUrl;
}

/* ── Médiathèque : toutes les photos déjà déposées (logo, favicon, hero,
   produits…) au même endroit, pour les réutiliser sans re-uploader. Le bucket
   'boutique' est plat (pas de dossiers) — on liste tout ce qu'il contient. */
export async function listerMedias({ limite = 200, decalage = 0 } = {}) {
  const { data, error } = await supabase.storage.from('boutique')
    .list('', { limit: limite, offset: decalage, sortBy: { column: 'created_at', order: 'desc' } });
  if (error) throw new Error(error.message);
  return (data || [])
    .filter(f => f.id) // les dossiers renvoyés par l'API n'ont pas d'id
    .map(f => ({
      nom: f.name,
      taille: f.metadata?.size || 0,
      url: supabase.storage.from('boutique').getPublicUrl(f.name).data.publicUrl,
    }));
}

export async function supprimerMedia(nom) {
  const { error } = await supabase.storage.from('boutique').remove([nom]);
  if (error) throw new Error(error.message);
}

/* ── Pages ── */
export const listerPages = () => supabase.from('shop_pages').select('*').order('title').then(jeter);
export const enregistrerPage = (p) =>
  supabase.from('shop_pages').upsert({ ...p, updated_at: new Date().toISOString() }).select().single().then(jeter);
export const supprimerPage = (id) => supabase.from('shop_pages').delete().eq('id', id).then(jeter);

/* ── Réglages ── */
export const enregistrerReglages = (valeur) =>
  supabase.from('shop_settings').upsert({ key: 'boutique', value: valeur, updated_at: new Date().toISOString() }).then(jeter);

/* ── Avis clients (captures d'écran) ── */
export const enregistrerAvis = (valeur) =>
  supabase.from('shop_settings').upsert({ key: 'avis', value: valeur, updated_at: new Date().toISOString() }).then(jeter);

/* ── Codes promo ── */
export const listerCodes = () => supabase.from('shop_promo_codes').select('*').order('created_at', { ascending: false }).then(jeter);
export const enregistrerCode = (c) => supabase.from('shop_promo_codes').upsert(c).select().single().then(jeter);
export const supprimerCode = (id) => supabase.from('shop_promo_codes').delete().eq('id', id).then(jeter);
