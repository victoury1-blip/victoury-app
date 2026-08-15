/* Onglets de la page Commandes — source unique de vérité.
 *
 * La liste existait en QUATRE exemplaires : les onglets de la page, le menu
 * latéral, et la table qui traduit l'adresse en onglet. Ajouter « Annulé » sans
 * penser à cette dernière ouvrait l'adresse /commandes/annule sur « À
 * Confirmer », sans erreur ni indice — l'onglet existait, le menu le comptait,
 * mais la page en affichait un autre.
 *
 * Tout part désormais d'ici. Ajouter un onglet, c'est ajouter une entrée.
 */
import { A_CONFIRMER_STATUSES, EN_SUIVI_STATUSES, ANNULE_STATUSES } from './colisPipeline';

export const ORDER_TABS = [
  { id: 'a_confirmer', label: 'À Confirmer', statuses: A_CONFIRMER_STATUSES },
  { id: 'en_suivi', label: 'En Suivi', statuses: EN_SUIVI_STATUSES },
  { id: 'reporter', label: 'Reporté', statuses: ['reporter'] },
  { id: 'confirme', label: 'Confirmé', statuses: ['confirme'] },
  /* Sans compteur : une commande annulée est close, il n'y a rien à traiter.
     Un badge rouge la ferait passer pour du travail en attente. */
  { id: 'annule', label: 'Annulé', statuses: ANNULE_STATUSES, noBadge: true },
];

/* L'adresse utilise des tirets là où l'identifiant utilise des soulignés
   (« /commandes/a-confirmer » → « a_confirmer »). */
export const tabToParam = (id) => String(id).replace(/_/g, '-');

/** Onglet correspondant à un segment d'adresse, « À Confirmer » par défaut. */
export function tabFromParam(param) {
  const id = String(param || '').replace(/-/g, '_');
  return ORDER_TABS.some(t => t.id === id) ? id : ORDER_TABS[0].id;
}

/** Chemin complet d'un onglet, tel qu'attendu par le routeur et le menu. */
export const tabPath = (id) => `/commandes/${tabToParam(id)}`;
