import { supabase } from './supabase';

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

export async function publierVersBoutique(product) {
  if (!product?.ref) throw new Error('Produit sans référence');
  const collectionId = await getOrCreateSoldesCollection();
  const slug = slugify(product.ref) || slugify(product.name) || slugify(String(product.id));

  const { data: prod, error: errProd } = await supabase.from('shop_products')
    .upsert({
      slug, name: product.name || 'Produit', description: product.description || '',
      price: Number(product.prix) || 0,
      compare_at: product.compareAt && product.compareAt > product.prix ? Number(product.compareAt) : null,
      collection_id: collectionId, status: 'Actif',
    }, { onConflict: 'slug' })
    .select('id').single();
  if (errProd) throw new Error(errProd.message);
  const productId = prod.id;

  // Réenvoyer les photos à chaque publication serait lent (re-upload) et
  // laisserait des orphelines dans le bucket : on repart d'une fiche vide.
  await supabase.from('shop_product_images').delete().eq('product_id', productId);
  const images = (product.images?.length ? product.images : (product.image ? [product.image] : [])).slice(0, 8);
  const urlsHebergees = [];
  for (const url of images) {
    try { urlsHebergees.push(await rehebergerImage(url)); } catch { /* une photo en panne ne bloque pas les autres */ }
  }
  if (urlsHebergees.length) {
    await supabase.from('shop_product_images').insert(
      urlsHebergees.map((url, i) => ({ product_id: productId, url, position: i }))
    );
  }

  await supabase.from('shop_product_sizes').delete().eq('product_id', productId);
  const tailles = (product.variations || []).filter(v => v.taille);
  if (tailles.length) {
    await supabase.from('shop_product_sizes').insert(
      tailles.map((v, i) => ({ product_id: productId, size: v.taille, stock: Math.max(0, Number(v.stock) || 0), position: i }))
    );
  }

  return { productId, slug, imagesEnvoyees: urlsHebergees.length };
}
