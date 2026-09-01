import { supabase } from './supabase';
import { champsManquants, construireCommande } from './commande';

/* L'envoi, et lui seul, touche au réseau.
 *
 * La construction et la validation d'une commande restent dans un module sans
 * dépendance : elles peuvent ainsi être éprouvées isolément, ce qui est bien le
 * moins pour le code qui décide de ce qui sera facturé. */
export async function envoyerCommande(form, lignes, total) {
  const manque = champsManquants(form, lignes);
  if (manque.length) return { ok: false, manque };
  const commande = construireCommande(form, lignes, total);
  const { error } = await supabase.from('orders').insert(commande);
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: commande.id };
}
