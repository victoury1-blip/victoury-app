import { supabase } from './supabase';

const chiffres = (s) => (s || '').replace(/\D/g, '');
// Les 9 derniers chiffres seulement : les commandes stockent le téléphone
// normalisé ("0612345678"), le panier abandonné garde ce que le client a
// tapé tel quel ("+212612345678", avec espaces…) — une comparaison brute des
// chiffres ne matchait jamais, laissant des clients déjà convertis dans la
// liste de relance.
export const cleTel = (s) => chiffres(s).slice(-9);

/** Paniers actifs à relancer : un seul par téléphone (le plus récent), sans
    ceux dont le client est déjà revenu commander tout seul (même règle et
    même source utilisées par la page et par le badge du menu — un chiffre
    affiché à deux endroits ne doit jamais pouvoir diverger). */
export async function chargerPaniersActifs() {
  const [{ data: paniers }, { data: commandes }] = await Promise.all([
    supabase.from('shop_paniers_abandonnes').select('*').order('created_at', { ascending: false }).limit(200),
    // Pas de filtre sur `date_added` : la colonne est un texte
    // "JJ/MM/AAAA HH:MM:SS", pas une vraie date.
    supabase.from('orders').select('recipient').like('id', 'VS-%'),
  ]);
  const telsConvertis = new Set((commandes || []).map(o => cleTel(o.recipient?.phone)).filter(Boolean));

  const parTel = new Map();
  for (const p of paniers || []) {
    const cle = cleTel(p.telephone);
    if (!parTel.has(cle)) parTel.set(cle, p);
  }
  return [...parTel.values()].filter(p => !telsConvertis.has(cleTel(p.telephone)));
}
