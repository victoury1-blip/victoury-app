import { describe, it, expect } from 'vitest';

/* Valider une commande n'a pas le même sens selon le moment.
 *
 * Pour une commande qui part : créer le colis chez le transporteur et
 * l'envoyer au ramassage. Pour une commande déjà terminée — livrée, refusée,
 * saisie après coup — il n'y a plus de trajet à faire : la valider ne fait que
 * la rendre facturable.
 *
 * Le bouton ne connaissait que le premier cas : une commande LIVRÉE chez Ozon
 * ouvrait la fenêtre de création d'un colis pour une livraison déjà faite, et
 * restait donc sans effet ; elle ne pouvait jamais entrer dans une facture.
 */
const SORT_CONNU = new Set(['livre', 'refuse', 'annule', 'change', 'echange_recu', 'retour_recu']);

/** Ce que fait la validation : 'ozon' | 'ramassage' | 'facturable' | 'refus'. */
function actionValidation(order) {
  if (order.validated) return 'rien';
  const livreur = (order.recipient?.delivery || '').trim();
  if (!livreur) return 'refus';
  if (SORT_CONNU.has(order.status)) return 'facturable';
  if (livreur.toLowerCase().includes('ozon')) return 'ozon';
  return 'ramassage';
}

const chezOzon = (status) => ({ status, recipient: { delivery: 'Ozon Express' } });

describe('validation d’une commande', () => {
  it('une commande déjà livrée devient simplement facturable', () => {
    // Sans quoi le bouton ouvrait la création d'un colis déjà livré : sans effet.
    expect(actionValidation(chezOzon('livre'))).toBe('facturable');
    expect(actionValidation(chezOzon('refuse'))).toBe('facturable');
    expect(actionValidation(chezOzon('retour_recu'))).toBe('facturable');
  });

  it('une commande qui part suit toujours son trajet', () => {
    expect(actionValidation(chezOzon('confirme'))).toBe('ozon');
    expect(actionValidation({ status: 'confirme', recipient: { delivery: 'Livreur local' } })).toBe('ramassage');
  });

  it('rien ne se valide sans livreur', () => {
    expect(actionValidation({ status: 'livre', recipient: {} })).toBe('refus');
  });

  it('une commande déjà validée ne se revalide pas', () => {
    expect(actionValidation({ ...chezOzon('livre'), validated: true })).toBe('rien');
  });
});
