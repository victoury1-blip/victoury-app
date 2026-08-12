import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../lib/cloudSettings', () => ({ cloudSet: () => {} }));

const nouveau = (code) => ({ id: 'WC-' + code, trackingNumber: code, status: 'nouveau' });
const colis   = (code) => ({ id: 'WC-' + code, trackingNumber: code, status: 'livre', validated: true });
const suivi   = (code) => ({ id: 'WC-' + code, trackingNumber: code, status: 'pas_rep_1' });

// Le module retient les numéros réservés pendant la session : chaque test doit
// partir d'un module neuf.
let generateVictId, isVictCode, peekNextVictId, setNextNumber;

describe('série VI', () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.resetModules();
    ({ generateVictId, isVictCode, peekNextVictId, setNextNumber } = await import('../lib/victId.js'));
  });

  it('démarre à VI00001 quand aucune commande n’en porte', () => {
    expect(generateVictId([])).toBe('VI00001');
  });

  it('ne se confond pas avec les anciennes séries', () => {
    // VICT0002 a un « C » là où VI attend un chiffre : aucun croisement possible.
    expect(generateVictId([nouveau('VICT0002'), nouveau('VICTOURY0150')])).toBe('VI00001');
    expect(isVictCode('VI00001')).toBe(true);
    expect(isVictCode('VICT0002')).toBe(true);
    expect(isVictCode('VICTOURY0150')).toBe(true);
    expect(isVictCode('WC-2074')).toBe(false);
  });

  it('continue après le plus grand numéro « À Confirmer »', () => {
    expect(generateVictId([nouveau('VI00007'), nouveau('VI00003')])).toBe('VI00008');
  });

  it('ignore la Liste des Colis et « En Suivi » dans le calcul', () => {
    const orders = [nouveau('VI00004'), colis('VI00900'), suivi('VI00500')];
    expect(generateVictId(orders)).toBe('VI00005');
  });

  it('saute néanmoins un numéro porté ailleurs, pour ne pas créer de doublon', () => {
    const orders = [nouveau('VI00004'), colis('VI00005'), suivi('VI00006')];
    expect(generateVictId(orders)).toBe('VI00007');
  });

  it('respecte le point de départ réglé dans Réglages', () => {
    setNextNumber(1);
    const orders = [nouveau('VI00042'), colis('VI00900')];
    expect(generateVictId(orders)).toBe('VI00001');
    expect(generateVictId(orders)).toBe('VI00002');
  });

  it('annonce le prochain numéro sans le consommer', () => {
    const orders = [nouveau('VI00010')];
    expect(peekNextVictId(orders)).toBe('VI00011');
    expect(peekNextVictId(orders)).toBe('VI00011');
    expect(generateVictId(orders)).toBe('VI00011');
  });

  it('n’attribue pas de numéro à une commande qui a déjà un code', () => {
    const hasCode = (o) => !!String(o.trackingNumber || '').trim() || isVictCode(o.id);
    expect(hasCode({ id: 'WC-1', trackingNumber: 'WC-1959' })).toBe(true);
    expect(hasCode({ id: 'WC-2', trackingNumber: 'MIMA3350' })).toBe(true);
    expect(hasCode({ id: 'WC-3', trackingNumber: '   ' })).toBe(false);
  });

  it('poursuit la série même si la liste des commandes est incomplète', () => {
    // Cas d'une création manuelle lancée avant que la liste soit chargée.
    const orders = [nouveau('VI00006')];
    expect(generateVictId(orders)).toBe('VI00007');
    // Liste vide au coup suivant : la série ne doit pas repartir de 1.
    expect(generateVictId([])).toBe('VI00008');
  });

  it('émet des numéros distincts à la suite', () => {
    const orders = [];
    expect(generateVictId(orders)).toBe('VI00001');
    expect(generateVictId(orders)).toBe('VI00002');
    expect(generateVictId(orders)).toBe('VI00003');
  });
});
