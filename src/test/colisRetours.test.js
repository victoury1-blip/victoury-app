import { describe, it, expect } from 'vitest';
import { estColisRetour, estRecu } from '../lib/colisRetours';

describe('colis retours', () => {
  it('garde les refusés / retours du circuit colis', () => {
    expect(estColisRetour({ status: 'refuse' })).toBe(true);
    expect(estColisRetour({ status: 'retour_recu' })).toBe(true);
    expect(estColisRetour({ status: 'pret_retour' })).toBe(true);
    expect(estColisRetour({ status: 'livre' })).toBe(false);
  });

  it('ne garde un « Annulé » que s’il a été expédié', () => {
    expect(estColisRetour({ status: 'annule' })).toBe(false);
    expect(estColisRetour({ status: 'annule', trackingNumber: 'VI00012', validated: true })).toBe(true);
  });

  it('reçu se lit sur la commande ou sur l’ancienne liste', () => {
    expect(estRecu({ id: 'A', recu: true }, new Set())).toBe(true);
    expect(estRecu({ id: 'A' }, new Set(['A']))).toBe(true);
    expect(estRecu({ id: 'A' }, new Set())).toBe(false);
  });
});
