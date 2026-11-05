import { supabase } from './supabase';

const chiffres = (s) => (s || '').replace(/\D/g, '');
// Les 9 derniers chiffres seulement : les commandes stockent le téléphone
// normalisé ("0612345678"), le panier abandonné garde ce que le client a
// tapé tel quel ("+212612345678", avec espaces…) — une comparaison brute des
// chiffres ne matchait jamais, laissant des clients déjà convertis dans la
// liste de relance.
export const cleTel = (s) => chiffres(s).slice(-9);

/** Paniers à relancer : un seul par téléphone (le plus récent), sans ceux
    dont le client a commandé APRÈS avoir laissé ce panier. Une commande plus
    ancienne (client fidèle, numéro de test de l'équipe) ne masque plus rien. */
export function filtrerPaniersActifs(paniers, commandes) {
  const derniereCommande = new Map();
  for (const o of commandes || []) {
    const cle = cleTel(o.recipient?.phone);
    if (!cle) continue;
    const t = Date.parse(o.created_at) || 0;
    if (t > (derniereCommande.get(cle) || 0)) derniereCommande.set(cle, t);
  }
  const parTel = new Map();
  for (const p of [...(paniers || [])].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))) {
    const cle = cleTel(p.telephone);
    if (cle && !parTel.has(cle)) parTel.set(cle, p);
  }
  return [...parTel.values()].filter(p => !((derniereCommande.get(cleTel(p.telephone)) || 0) >= (Date.parse(p.created_at) || 0)));
}

/** (même règle pour la page et pour le badge du menu) */
export async function chargerPaniersActifs() {
  const [{ data: paniers }, { data: commandes }] = await Promise.all([
    supabase.from('shop_paniers_abandonnes').select('*').order('created_at', { ascending: false }).limit(300),
    supabase.from('orders').select('recipient, created_at').like('id', 'VS-%').order('created_at', { ascending: false }).limit(1000),
  ]);
  return filtrerPaniersActifs(paniers, commandes);
}

/* Client « visiteur » (clé publique, sans session) : la règle d'accès de la
   table orders n'autorise la création d'une commande du site qu'à ce rôle —
   exactement comme une commande passée sur la boutique. */
let anonyme = null;
async function clientAnonyme() {
  if (!anonyme) {
    const { createClient } = await import('@supabase/supabase-js');
    anonyme = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, storageKey: 'victoury-relance' },
    });
  }
  return anonyme;
}

/** Transforme un panier abandonné en commande « nouveau » (onglet À Confirmer
    de l'application), après accord de la cliente au téléphone / WhatsApp. */
export async function envoyerPanierAConfirmer(panier, { construireCommande }) {
  const lignes = (panier.lignes || []).filter(l => l?.name);
  if (!lignes.length) return { ok: false, error: 'Panier vide' };
  const commande = construireCommande(
    { nom: panier.nom || 'Client', telephone: panier.telephone, ville: panier.ville || '', adresse: panier.adresse || '' },
    lignes, Number(panier.total) || 0, new Date(), undefined, { source: 'Relance' },
  );
  commande.note = 'Commande du site — relance panier abandonné';
  const client = await clientAnonyme();
  const { error } = await client.from('orders').insert(commande);
  if (error) return { ok: false, error: error.message };

  // Le stock baisse comme pour une commande passée sur le site.
  const { data: produits } = await supabase.from('shop_products').select('slug, name').in('name', [...new Set(lignes.map(l => l.name))]);
  const slugDe = new Map((produits || []).map(p => [p.name, p.slug]));
  await Promise.all(lignes.filter(l => slugDe.get(l.name)).map(l =>
    client.rpc('shop_decrement_stock', { p_slug: slugDe.get(l.name), p_size: l.size || '', p_qty: l.qty || 1 }).then(() => {}, () => {})));
  return { ok: true, id: commande.id };
}
