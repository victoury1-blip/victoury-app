import { supabase } from './supabase';
import { colorNameFromCss } from './chicAffiliate';

/* Publie un produit du Stock (souvent importé d'une plateforme d'affiliation
   comme Bouait) vers le catalogue du site (shop_products, base Supabase
   PARTAGÉE avec la boutique) — sous la collection « Soldes ». Republier le
   même produit (même `ref`) met à jour la fiche existante au lieu d'en créer
   une deuxième : le slug est dérivé de la référence, stable d'un envoi à l'autre. */

const SLUG_COLLECTION = 'soldes';

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function getOrCreateSoldesCollection() {
  const { data: existing } = await supabase.from('shop_collections')
    .select('id').eq('slug', SLUG_COLLECTION).maybeSingle();
  if (existing) return existing.id;
  const { data: created, error } = await supabase.from('shop_collections')
    .insert({ slug: SLUG_COLLECTION, name: 'Soldes' }).select('id').single();
  if (error) throw new Error(error.message);
  return created.id;
}

/* Sur le site, une couleur = une fiche produit à part entière, reliée aux
   autres couleurs du même article par un groupe (pastilles de couleur sur la
   fiche) — c'est ainsi que le Stock d'un fournisseur d'affiliation (une seule
   fiche, un tableau `colors`) doit être éclaté pour que le site propose
   vraiment un choix de couleur, pas seulement de taille. */
async function getOrCreateGroupe(slug, name) {
  const { data: existing } = await supabase.from('shop_groups')
    .select('id').eq('slug', slug).maybeSingle();
  if (existing) return existing.id;
  const { data: created, error } = await supabase.from('shop_groups')
    .insert({ slug, name }).select('id').single();
  if (error) throw new Error(error.message);
  return created.id;
}

/* Les images d'un produit d'affiliation passent par le proxy /api/chic-image
   du CRM (contourne le hotlink-protection du fournisseur) — une adresse qui
   n'existe pas sur le domaine du site. On les retélécharge donc ici et on les
   redépose dans le bucket 'boutique' (même stockage Supabase que le site),
   pour une image qui reste servie même si le fournisseur tombe en panne. */
async function rehebergerImage(url) {
  const reponse = await fetch(url);
  if (!reponse.ok) throw new Error(`Image inaccessible (${reponse.status})`);
  const blob = await reponse.blob();
  const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  const nom = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('boutique').upload(nom, blob, {
    contentType: blob.type || 'image/jpeg', cacheControl: '31536000', upsert: false,
  });
  if (error) throw new Error(error.message);
  return supabase.storage.from('boutique').getPublicUrl(nom).data.publicUrl;
}

async function publierUneFiche({ slug, name, description, price, compareAt, collectionId, groupId, colorName, colorHex, images, tailles }) {
  const { data: prod, error: errProd } = await supabase.from('shop_products')
    .upsert({
      slug, name, description: description || '',
      price: Number(price) || 0,
      compare_at: compareAt && compareAt > price ? Number(compareAt) : null,
      collection_id: collectionId, group_id: groupId || null,
      color_name: colorName || null, color_hex: colorHex || null,
      status: 'Actif',
    }, { onConflict: 'slug' })
    .select('id').single();
  if (errProd) throw new Error(errProd.message);
  const productId = prod.id;

  // Réenvoyer les photos à chaque publication serait lent (re-upload) et
  // laisserait des orphelines dans le bucket : on repart d'une fiche vide.
  await supabase.from('shop_product_images').delete().eq('product_id', productId);
  const urlsHebergees = [];
  for (const url of images.slice(0, 8)) {
    try { urlsHebergees.push(await rehebergerImage(url)); } catch { /* une photo en panne ne bloque pas les autres */ }
  }
  if (urlsHebergees.length) {
    await supabase.from('shop_product_images').insert(
      urlsHebergees.map((url, i) => ({ product_id: productId, url, position: i }))
    );
  }

  await supabase.from('shop_product_sizes').delete().eq('product_id', productId);
  if (tailles.length) {
    await supabase.from('shop_product_sizes').insert(
      tailles.map((v, i) => ({ product_id: productId, size: v.taille, stock: Math.max(0, Number(v.stock) || 0), position: i }))
    );
  }

  return { productId, slug, imagesEnvoyees: urlsHebergees.length };
}

export async function publierVersBoutique(product) {
  if (!product?.ref) throw new Error('Produit sans référence');
  const collectionId = await getOrCreateSoldesCollection();
  const baseSlug = slugify(product.ref) || slugify(product.name) || slugify(String(product.id));
  const images = product.images?.length ? product.images : (product.image ? [product.image] : []);
  const tailles = (product.variations || []).filter(v => v.taille);
  // Couleurs valides seulement : un id sans libellé ni couleur de fond n'a
  // rien à montrer sur une pastille et casserait juste le nom de la fiche.
  const couleurs = (product.colors || []).filter(c => c.label || c.bg);

  if (couleurs.length < 2) {
    const c = couleurs[0];
    return await publierUneFiche({
      slug: baseSlug, name: product.name, description: product.description,
      price: product.prix, compareAt: product.compareAt, collectionId,
      colorName: c?.label || (c?.bg ? colorNameFromCss(c.bg) : ''), colorHex: c?.bg || '',
      images, tailles,
    });
  }

  // Une fiche par couleur, reliées par un même groupe — le site affiche
  // alors les pastilles de couleur sur la page produit, comme pour les
  // articles déjà en boutique.
  const groupId = await getOrCreateGroupe(baseSlug, product.name);
  const resultats = [];
  for (const c of couleurs) {
    const nomCouleur = c.label || colorNameFromCss(c.bg) || `couleur-${c.id}`;
    resultats.push(await publierUneFiche({
      slug: `${baseSlug}-${slugify(nomCouleur)}`, name: product.name, description: product.description,
      price: product.prix, compareAt: product.compareAt, collectionId, groupId,
      colorName: nomCouleur, colorHex: c.bg || '',
      images, tailles,
    }));
  }
  return { variantes: resultats, slug: baseSlug };
}
