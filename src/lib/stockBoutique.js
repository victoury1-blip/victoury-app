/* Une commande saisie à la main dans l'application (bouton « Nouveau » :
 * WhatsApp, Instagram, téléphone…) retire ses pièces du stock de la
 * boutique en ligne, comme une commande passée sur le site — sinon le site
 * continuait d'afficher en stock une taille déjà vendue.
 *
 * Le produit du site est retrouvé par son NOM (« Ensemble Sport Noir »,
 * « Ensemble Sporte Rose » = « Ensemble Sport Rose ») et sa taille. */
import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

export const normNom = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\bsporte\b/g, 'sport').replace(/\s*[-–]\s*(xxs|xs|s|m|l|xl|xxl|2xl|3xl|4xl|5xl)\s*$/i, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();

/** Lignes { slug, size, qty } à retirer, et les articles introuvables sur le site. */
export function lignesARetirer(order, produitsBoutique) {
  const parNom = new Map((produitsBoutique || []).map(p => [normNom(p.name), p]));
  const l = Array.isArray(order?.products) && order.products.length ? order.products : (order?.product?.name ? [order.product] : []);
  const aRetirer = [], introuvables = [];
  for (const art of l) {
    const p = parNom.get(normNom(art?.name));
    const taille = String(art?.size || '').trim().toUpperCase();
    const t = p?.sizes?.find(x => String(x.size).trim().toUpperCase() === taille);
    if (!p || (taille && !t)) { introuvables.push(`${art?.name || '?'}${taille ? ` (${taille})` : ''}`); continue; }
    aRetirer.push({ slug: p.slug, size: t ? t.size : '', qty: Number(art?.qty) || 1 });
  }
  return { aRetirer, introuvables };
}

/* Même voie que la boutique (fonction shop_decrement_stock, ouverte au rôle
   « visiteur ») : un client sans session, pour ne dépendre d'aucun droit de
   l'utilisateur connecté. */
let anonyme = null;
const clientAnonyme = () => (anonyme ||= createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, storageKey: 'victoury-stock-boutique' },
}));

/** Retire du stock du site les pièces d'une ou plusieurs commandes manuelles. */
export async function retirerDuStockBoutique(orders) {
  const liste = (orders || []).filter(o => o && !String(o.id || '').startsWith('VS-')); // les commandes du site l'ont déjà fait
  if (!liste.length) return { retirees: 0, introuvables: [] };
  const { data: produits, error } = await supabase.from('shop_products').select('slug, name, sizes:shop_product_sizes(size, stock)');
  if (error) return { retirees: 0, introuvables: [], erreur: error.message };
  let retirees = 0; const introuvables = [];
  for (const o of liste) {
    const r = lignesARetirer(o, produits);
    introuvables.push(...r.introuvables);
    for (const l of r.aRetirer) {
      const { error: e } = await clientAnonyme().rpc('shop_decrement_stock', { p_slug: l.slug, p_size: l.size, p_qty: l.qty });
      if (!e) retirees += l.qty;
    }
  }
  return { retirees, introuvables };
}
