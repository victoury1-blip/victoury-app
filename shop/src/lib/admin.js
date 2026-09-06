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

// Changement de statut isolé (liste des produits, colonne Statut) : un
// update ciblé plutôt que ré-enregistrer toute la fiche, qui écraserait un
// champ modifié entre-temps par un autre onglet.
export const changerStatutProduit = (id, status) =>
  supabase.from('shop_products').update({ status, updated_at: new Date().toISOString() }).eq('id', id).then(jeter);

/* Dupliquer repart d'une fiche déjà photographiée et détaillée — plus rapide
   que retaper une variante (autre couleur, réédition) depuis zéro. En
   Brouillon : la copie ne doit jamais apparaître dans la boutique avant
   d'avoir été relue (prix, tailles, description toujours à confirmer). */
export async function dupliquerProduit(p) {
  const { id, created_at, images, sizes, ...champs } = p;
  const nouveau = await enregistrerProduit({
    ...champs,
    slug: `${p.slug}-copie-${Date.now().toString(36)}`,
    name: `${p.name} (copie)`,
    status: 'Brouillon',
  });
  if (images?.length) await remplacerImages(nouveau.id, images.map(({ url, alt }) => ({ url, alt })));
  if (sizes?.length) await remplacerTailles(nouveau.id, sizes.map(({ size, stock }) => ({ size, stock })));
  return nouveau;
}

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

// Une photo prise directement au téléphone pèse souvent plusieurs Mo — bien
// au-delà de ce qu'un écran peut jamais afficher (une carte produit ne
// montre jamais plus de quelques centaines de pixels de large). Redimensionnée
// et recompressée ICI, à l'unique endroit par où passe tout dépôt de photo
// (fiche produit, médiathèque, thème), l'admin n'a jamais à y penser lui-même.
// Le SVG (vectoriel) et le GIF (animé — le canvas n'en garderait qu'une
// image fixe) passent tels quels.
const TAILLE_MAX = 1600; // px, plus grand côté — largement suffisant pour du plein écran
// Une grille (carte produit, catégorie) n'affiche jamais plus de quelques
// centaines de pixels de large — pas besoin de la photo pleine résolution.
// Une vraie miniature, générée une fois au dépôt et stockée à côté de
// l'originale (suffixe "-thumb"), coûte un aller-retour réseau normal —
// contrairement à une transformation "à la volée" côté serveur, qui s'est
// montrée indisponible/trop lente sur ce projet Supabase.
const TAILLE_MINIATURE = 500;

async function redimensionner(fichier, tailleMax) {
  if (!fichier.type?.startsWith('image/') || fichier.type === 'image/svg+xml' || fichier.type === 'image/gif') {
    return fichier;
  }
  try {
    const bitmap = await createImageBitmap(fichier);
    const echelle = Math.min(1, tailleMax / Math.max(bitmap.width, bitmap.height));
    // Une image déjà WebP, déjà à la bonne taille et déjà légère ne vaut pas
    // la peine d'être ré-encodée. Un JPEG ou (surtout) un PNG (capture
    // d'écran, souvent) reste converti même sous ce poids : le format à lui
    // seul, sans rapport avec les dimensions, pèse largement plus que le WebP
    // — c'est justement le format "moderne" que PageSpeed réclame.
    if (echelle === 1 && fichier.type === 'image/webp' && fichier.size < 300_000) return fichier;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * echelle);
    canvas.height = Math.round(bitmap.height * echelle);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.8));
    if (!blob || blob.size >= fichier.size) return fichier; // le résultat compressé n'aide pas, on garde l'original
    return new File([blob], fichier.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' });
  } catch {
    return fichier; // une image illisible par le navigateur (format exotique) part telle quelle
  }
}

/** Nom du fichier miniature associé à une photo — même base, suffixe "-thumb". */
export function nomMiniature(nom) {
  return nom.replace(/\.[^.]+$/, '') + '-thumb.webp';
}

export async function televerserPhoto(fichierBrut) {
  const fichier = await redimensionner(fichierBrut, TAILLE_MAX);
  const ext = (fichier.name.split('.').pop() || 'jpg').toLowerCase();
  // Nom aléatoire : deux photos du même nom déposées le même jour s'écraseraient.
  const nom = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('boutique').upload(nom, fichier, {
    cacheControl: '31536000', upsert: false,
  });
  if (error) throw new Error(error.message);

  // Best-effort : une miniature manquante retombe sur l'originale (voir
  // lib/img.js), jamais sur un dépôt bloqué si la génération échoue.
  try {
    const miniature = await redimensionner(fichierBrut, TAILLE_MINIATURE);
    await supabase.storage.from('boutique').upload(nomMiniature(nom), miniature, {
      cacheControl: '31536000', upsert: false, contentType: miniature.type || 'image/webp',
    });
  } catch { /* la photo pleine taille reste utilisable partout */ }

  return supabase.storage.from('boutique').getPublicUrl(nom).data.publicUrl;
}

// Photos déjà déposées AVANT la compression automatique — recompressées à
// la demande depuis la médiathèque, sur place (même nom de fichier, donc
// même URL publique) pour que rien de ce qui la référence déjà (fiche
// produit, thème…) n'ait besoin d'être mis à jour. Génère aussi la
// miniature manquante au passage.
export async function recompresserMedia(nom) {
  const { data: blob, error: e1 } = await supabase.storage.from('boutique').download(nom);
  if (e1) throw new Error(e1.message);
  const fichierOriginal = new File([blob], nom, { type: blob.type });

  const compresse = await redimensionner(fichierOriginal, TAILLE_MAX);
  if (compresse !== fichierOriginal) {
    const { error: e2 } = await supabase.storage.from('boutique').upload(nom, compresse, {
      cacheControl: '31536000', upsert: true, contentType: compresse.type || 'image/webp',
    });
    if (e2) throw new Error(e2.message);
  }

  try {
    const miniature = await redimensionner(fichierOriginal, TAILLE_MINIATURE);
    await supabase.storage.from('boutique').upload(nomMiniature(nom), miniature, {
      cacheControl: '31536000', upsert: true, contentType: miniature.type || 'image/webp',
    });
  } catch { /* la médiathèque affiche déjà la version pleine taille */ }

  return compresse !== fichierOriginal;
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
    // Les miniatures ("-thumb") sont un détail technique de livraison —
    // les montrer comme des photos à part encombrerait la médiathèque et
    // laisserait la supprimer sans supprimer l'originale qui va avec.
    // ".jpg" est l'ancien suffixe (avant le passage au format WebP) : des
    // fichiers déposés plus tôt peuvent encore en avoir un qui traîne.
    .filter(f => !f.name.endsWith('-thumb.webp') && !f.name.endsWith('-thumb.jpg'))
    .map(f => ({
      nom: f.name,
      taille: f.metadata?.size || 0,
      url: supabase.storage.from('boutique').getPublicUrl(f.name).data.publicUrl,
    }));
}

export async function supprimerMedia(nom) {
  // Le nom historique ("-thumb.jpg") peut encore exister pour une photo
  // jamais reconvertie depuis le passage au WebP — le supprimer aussi évite
  // de laisser un fichier orphelin dans le bucket.
  const ancienneMiniature = nom.replace(/\.[^.]+$/, '') + '-thumb.jpg';
  const { error } = await supabase.storage.from('boutique').remove([nom, nomMiniature(nom), ancienneMiniature]);
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
