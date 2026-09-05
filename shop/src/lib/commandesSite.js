import { supabase } from './supabase';

/** Commandes du site (VS-…) encore "En attente" (status nouveau), archivées
    exclues — même règle que CommandesListe.jsx, pour que le badge du menu
    et la page ne puissent jamais afficher un chiffre différent. */
export async function compterCommandesEnAttente() {
  const { data } = await supabase.from('orders').select('id, status, is_deleted').like('id', 'VS-%');
  return (data || []).filter(c => !c.is_deleted && c.status === 'nouveau').length;
}
