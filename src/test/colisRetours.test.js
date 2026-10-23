import { describe, it, expect } from 'vitest';
import { estColisRetour, estRecu, estImportSheet } from '../lib/colisRetours';

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

  it('écarte les colis importés depuis Google Sheets', () => {
    const sheet = { id: 'VICT0123', trackingNumber: 'VICT0123', status: 'refuse', validated: true };
    expect(estImportSheet(sheet)).toBe(true);
    expect(estColisRetour(sheet)).toBe(false);
    expect(estImportSheet({ id: 'X', trackingNumber: 'Y', recipient: { importe: 'sheet' } })).toBe(true);
  });

  it('garde les commandes du système', () => {
    expect(estImportSheet({ id: 'VI00435', trackingNumber: 'VI00435' })).toBe(false);
    expect(estImportSheet({ id: 'VS-221026-1531217', trackingNumber: 'VI00458' })).toBe(false);
    expect(estImportSheet({ id: 'VI00400', trackingNumber: 'OZ123456' })).toBe(false);
    expect(estColisRetour({ id: 'VI00435', trackingNumber: 'VI00435', status: 'refuse' })).toBe(true);
  });
});
