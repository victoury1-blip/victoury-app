/* Liste persistante des commandes du site "pas encore vues" — le filet de
 * sécurité derrière la notification système (notifCommande.js) et le push
 * (pushNotif.js), qui dépendent tous les deux d'une permission navigateur
 * et d'un onglet resté ouvert : si l'un ou l'autre a été refusé, révoqué, ou
 * que l'onglet était fermé au moment de la commande, RIEN ne prévenait
 * l'admin — pas même un signe visuel au retour sur la page. Cette liste,
 * elle, vit en localStorage : elle ne dépend d'aucune permission et
 * survient sûrement, même après un rechargement complet.
 */
const CLE = 'shop_commandes_non_vues';
const MAX = 30;

export function lireCommandesNonVues() {
  try {
    const l = JSON.parse(localStorage.getItem(CLE) || '[]');
    return Array.isArray(l) ? l : [];
  } catch {
    return [];
  }
}

/** Ajoute une commande en tête de liste (dédoublonnée par id), bornée à MAX. */
export function ajouterCommandeNonVue(commande) {
  const l = lireCommandesNonVues().filter(c => c.id !== commande.id);
  l.unshift({
    id: commande.id,
    nom: commande.recipient?.name || 'Client',
    ville: commande.recipient?.city || '',
    prix: commande.price || 0,
    date: commande.date_added || new Date().toISOString(),
  });
  const bornee = l.slice(0, MAX);
  try { localStorage.setItem(CLE, JSON.stringify(bornee)); } catch { /* quota */ }
  return bornee;
}

export function marquerCommandesVues() {
  try { localStorage.setItem(CLE, '[]'); } catch { /* quota */ }
}
