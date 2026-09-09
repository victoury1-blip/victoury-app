import { supabase } from './supabase';

/* Avis clients EN ÉTOILES sur un produit précis — différent de
 * catalog.js/chargerAvis() (des captures d'écran WhatsApp choisies à la main
 * par l'admin, voir AvisListe.jsx). Ici, un vrai formulaire client, modéré
 * avant publication (voir schema.sql, table shop_reviews). */

export async function chargerAvisProduit(productId) {
  const { data, error } = await supabase
    .from('shop_reviews')
    .select('id, rating, author_name, comment, verified_purchase, created_at')
    .eq('product_id', productId).eq('status', 'approuve')
    .order('created_at', { ascending: false });
  if (error) return [];
  return data || [];
}

/** Moyenne + nombre d'avis approuvés — pour l'étoile résumée sous le titre. */
export async function chargerResumeAvis(productId) {
  const { data, error } = await supabase.rpc('shop_reviews_resume', { p_product_id: productId });
  if (error || !data?.length) return { moyenne: 0, total: 0 };
  return { moyenne: Number(data[0].moyenne) || 0, total: Number(data[0].total) || 0 };
}

/** Dépôt d'un avis — passe par une fonction (jamais un INSERT direct) : le
    statut "en_attente" et le badge "Achat vérifié" sont calculés côté
    serveur, jamais fournis par le client (voir shop_submit_review). */
export async function soumettreAvis({ productId, rating, author, comment, telephone }) {
  const { error } = await supabase.rpc('shop_submit_review', {
    p_product_id: productId, p_rating: rating, p_author: author,
    p_comment: comment || '', p_telephone: telephone || null,
  });
  if (error) return { ok: false, error: error.message || "Envoi impossible." };
  return { ok: true };
}
