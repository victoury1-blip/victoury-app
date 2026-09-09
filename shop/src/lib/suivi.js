/* Suivi de commande public : une trentaine de statuts internes (voir
 * src/data/statuses.js côté application) — beaucoup trop, et souvent trop
 * francs ("Pas de Réponse 3 Fois", "Injoignable") pour être montrés tels
 * quels à une cliente. Cette table les ramène à 5 étapes publiques, celles
 * qu'un client comprend sans explication. */
const ETAPES = {
  // Encore en cours de traitement côté équipe — la cliente n'a rien à faire.
  recue: [
    'nouveau', 'a_voir', 'interesse', 'en_attente', 'manque_stock',
    'pas_rep_1', 'pas_reponse', 'pas_rep_2', 'pas_rep_3', 'pas_rep_4', 'pas_rep_5',
    'injoignable', 'photo_whatsapp', 'dem_suivi', 'en_suivi', 'pas_rep_lv',
  ],
  confirmee: ['confirme', 'att_ramassage'],
  expediee: ['expedier', 'recu_livreur'],
  livree: ['livre'],
  annulee: ['annule', 'refuse', 'black_liste'],
  // Reportée : une nouvelle date de livraison a été fixée — reste "en
  // cours", mais avec une date à afficher (voir reportDate).
  reportee: ['reporter'],
  // Retour/échange : la commande est revenue ou a été échangée après coup.
  retournee: ['change', 'retour_recu', 'echange_recu', 'pret_retour'],
};

const parStatut = new Map(
  Object.entries(ETAPES).flatMap(([etape, valeurs]) => valeurs.map(v => [v, etape]))
);

/** Étape publique d'un statut interne — 'recue' pour tout statut inconnu,
    plutôt que de casser l'affichage sur un statut ajouté depuis /store. */
export const etapePublique = (status) => parStatut.get(status) || 'recue';

// Ordre d'affichage de la frise, et à quelle étape chacune correspond une
// fois "atteinte" — permet de savoir jusqu'où colorer la frise.
export const FRISE = ['recue', 'confirmee', 'expediee', 'livree'];

const LIBELLES = {
  fr: {
    recue: 'Commande reçue', confirmee: 'Confirmée', expediee: 'Expédiée', livree: 'Livrée',
    annulee: 'Annulée', reportee: 'Livraison reportée', retournee: 'Retournée / échangée',
  },
  ar: {
    recue: 'تم استلام الطلب', confirmee: 'مؤكد', expediee: 'تم الشحن', livree: 'تم التسليم',
    annulee: 'ملغى', reportee: 'تم تأجيل التوصيل', retournee: 'تم الإرجاع / التبديل',
  },
};

export const libelleEtape = (etape, lang) => (LIBELLES[lang] || LIBELLES.fr)[etape] || etape;

/** Appel de l'API de suivi (voir api/suivi.js) — jamais Supabase en direct
    depuis le navigateur, la clé publique n'a pas accès en lecture aux
    commandes (voir le commentaire dans api/suivi.js). */
export async function chercherCommande(id, telephone) {
  try {
    const res = await fetch('/api/suivi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, telephone }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.ok) return { ok: false, error: d.error || 'Recherche impossible.' };
    return { ok: true, commande: d.commande };
  } catch {
    return { ok: false, error: 'Recherche impossible. Vérifiez votre connexion.' };
  }
}
