/* Circuit COLIS — source unique de vérité.
 *
 * Ces statuts définissent ce qui apparaît dans la Liste des Colis. La liste
 * était recopiée dans OrdersPage, ListeColisPage et Sidebar : la moindre
 * divergence faisait qu'une commande comptée dans le badge du menu
 * n'apparaissait pas dans la page (ou l'inverse). On l'importe désormais.
 */
export const COLIS_PIPELINE = [
  'att_ramassage',
  'expedier',
  'recu_livreur',
  'livre',
  'change',
  'refuse',
  'pas_rep_lv',
  'pret_retour',
  'en_suivi',
  'retour_recu',
  'echange_recu',
];

export const COLIS_PIPELINE_SET = new Set(COLIS_PIPELINE);

/** Une commande fait-elle partie du circuit colis ? */
export const isInColisPipeline = (status) => COLIS_PIPELINE_SET.has(status);

/* Statuts des onglets « À Confirmer » et « En Suivi » (page Commandes).
 * Exportés ici pour que l'outil de renumérotation vise exactement les mêmes
 * commandes que celles affichées dans ces onglets. */
export const A_CONFIRMER_STATUSES = ['nouveau'];

/* « Annulé » N'EST PAS un statut de suivi : la commande est close, il n'y a plus
 * rien à relancer. Compté dans « En Suivi », il gonflait le nombre de commandes
 * à traiter avec des dossiers terminés. Il a son propre onglet — le retirer sans
 * lui en donner un aurait rendu ces commandes introuvables. */
export const EN_SUIVI_STATUSES = [
  'en_attente', 'a_voir', 'interesse', 'photo_whatsapp', 'black_liste',
  'injoignable', 'pas_reponse', 'pas_rep_1', 'pas_rep_2', 'pas_rep_3',
  'pas_rep_4', 'pas_rep_5', 'manque_stock', 'dem_suivi',
];

export const ANNULE_STATUSES = ['annule'];
