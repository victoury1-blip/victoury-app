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
