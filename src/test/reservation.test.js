import { describe, it, expect } from 'vitest';
import { reservationEnAttente } from '../lib/reservation';

describe('réservation boutique', () => {
  it('cache de À Confirmer tant qu’elle n’est pas envoyée', () => {
    expect(reservationEnAttente({ status: 'nouveau', recipient: { reservation: { envoyee: false } } })).toBe(true);
    expect(reservationEnAttente({ status: 'nouveau', recipient: { reservation: { envoyee: true } } })).toBe(false);
    expect(reservationEnAttente({ status: 'nouveau', recipient: {}, note: 'Commande du site\n⏳ RÉSERVATION — X (L) : disponible le mardi 03/11' })).toBe(true);
    expect(reservationEnAttente({ status: 'nouveau', recipient: {}, note: 'Commande du site' })).toBe(false);
    expect(reservationEnAttente({ status: 'confirme', recipient: { reservation: { envoyee: false } } })).toBe(false);
  });
});
