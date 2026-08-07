import { describe, it, expect, beforeEach, vi } from 'vitest';

// cloudSet écrit dans Supabase : hors sujet ici, on le neutralise.
vi.mock('../lib/cloudSettings', () => ({ cloudSet: () => {} }));

const { generateVictId, initVictCounter, isVictCode } = await import('../lib/victId.js');

const withCode = (code) => ({ id: 'WC-' + code, trackingNumber: code });

describe('numérotation VICTOURY', () => {
  beforeEach(() => localStorage.clear());

  it('reconnaît les deux séries de codes', () => {
    expect(isVictCode('VICTOURY0044')).toBe(true);
    expect(isVictCode('VICT0050')).toBe(true);
    expect(isVictCode('WC-1959')).toBe(false);
    expect(isVictCode('')).toBe(false);
  });

  it('avance toujours et ne comble pas les trous', () => {
    // 0046 est libre entre 0045 et 0047 : il ne doit PAS être réattribué.
    const orders = [withCode('VICTOURY0044'), withCode('VICTOURY0045'), withCode('VICTOURY0047')];
    initVictCounter(orders);
    expect(generateVictId(orders)).toBe('VICTOURY0048');
  });

  it('ne redonne pas le numéro d’une commande supprimée', () => {
    const orders = [withCode('VICTOURY0047')];
    initVictCounter(orders);
    expect(generateVictId(orders)).toBe('VICTOURY0048');
    // 0047 et 0048 disparaissent : le suivant reste au-dessus.
    expect(generateVictId([])).toBe('VICTOURY0049');
  });

  it('ne redescend pas après un alignement sur les codes Ozon', () => {
    initVictCounter([withCode('VICTOURY0049')]);
    // Les codes VICTOURY ont été remplacés par ceux du transporteur.
    expect(generateVictId([withCode('VICT00050'), { id: 'WC-1959' }])).toBe('VICTOURY0050');
  });

  it('émet des numéros distincts à la suite', () => {
    const orders = [];
    const a = generateVictId(orders);
    const b = generateVictId(orders);
    expect(a).toBe('VICTOURY0001');
    expect(b).toBe('VICTOURY0002');
  });
});
