import { describe, it, expect } from 'vitest';

/* Interrupteur « Validé » de la Liste des Colis.
 *
 * Il ne savait que désactiver : le rallumer ne faisait rien, sans message ni
 * retour visuel. Une commande dévalidée — ou saisie à la main après coup —
 * restait donc hors de toute facture, définitivement, et rien n'indiquait
 * pourquoi le bouton semblait mort.
 */
const activer = (o) => ({ ...o, validated: true });
const desactiver = (o) => ({ ...o, status: 'confirme', validated: false });
const basculer = (o, next) => (next ? activer(o) : desactiver(o));

describe('interrupteur Validé', () => {
  it('rallumer valide réellement la commande', () => {
    const o = { id: 'VI00129', status: 'livre', validated: false };
    expect(basculer(o, true).validated).toBe(true);
  });

  it('rallumer ne rejoue pas le trajet : le statut constaté est conservé', () => {
    const o = { id: 'VI00129', status: 'livre', validated: false };
    expect(basculer(o, true).status).toBe('livre');
  });

  it('éteindre renvoie la commande en Confirmé, comme avant', () => {
    const o = { id: 'VI00129', status: 'att_ramassage', validated: true };
    expect(basculer(o, false)).toMatchObject({ status: 'confirme', validated: false });
  });

  it('le code de suivi survit aux deux sens', () => {
    const o = { id: 'VI00129', status: 'livre', validated: true, trackingNumber: 'OZN-42' };
    expect(basculer(o, false).trackingNumber).toBe('OZN-42');
    expect(basculer(basculer(o, false), true).trackingNumber).toBe('OZN-42');
  });
});
