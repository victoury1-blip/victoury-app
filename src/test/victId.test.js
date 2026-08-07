import { describe, it, expect, beforeEach, vi } from 'vitest';

// cloudSet écrit dans Supabase : hors sujet ici, on le neutralise.
vi.mock('../lib/cloudSettings', () => ({ cloudSet: () => {} }));

const withCode = (code) => ({ id: 'WC-' + code, trackingNumber: code });

// Le module garde en mémoire les numéros réservés pendant la session : chaque
// test doit partir d'un module neuf, sinon les réservations de l'un faussent
// le suivant.
let generateVictId, isVictCode, setNextNumber;

describe('numérotation VICTOURY', () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.resetModules();
    ({ generateVictId, isVictCode, setNextNumber } = await import('../lib/victId.js'));
  });

  it('reconnaît les deux séries de codes', () => {
    expect(isVictCode('VICTOURY0044')).toBe(true);
    expect(isVictCode('VICT0050')).toBe(true);
    expect(isVictCode('WC-1959')).toBe(false);
    expect(isVictCode('')).toBe(false);
  });

  it('avance toujours et ne comble pas les trous', () => {
    // 0046 est libre entre 0045 et 0047 : il ne doit PAS être réattribué.
    const orders = [withCode('VICTOURY0044'), withCode('VICTOURY0045'), withCode('VICTOURY0047')];
    expect(generateVictId(orders)).toBe('VICTOURY0048');
  });

  it('se recale sur les commandes réelles après correction de numéros erronés', () => {
    // Une attribution erronée avait poussé la série à 0192…
    expect(generateVictId([withCode('VICTOURY0192')])).toBe('VICTOURY0193');
    // …puis les commandes sont revenues à 0047 : la suite doit repartir de là,
    // et non rester bloquée au-dessus de l'erreur.
    expect(generateVictId([withCode('VICTOURY0047')])).toBe('VICTOURY0048');
  });

  it('ne réémet pas un numéro en attente d’enregistrement', () => {
    const orders = [withCode('VICTOURY0047')];
    // Deux créations rapprochées : la commande n'est pas encore dans la liste.
    expect(generateVictId(orders)).toBe('VICTOURY0048');
    expect(generateVictId(orders)).toBe('VICTOURY0049');
  });

  it('reconnaît qu’un code Ozon (WC-…, MIMA…) est bien un code', () => {
    // Le rattrapage de démarrage ne doit PAS voir ces commandes comme « sans
    // code » : sinon il leur réattribue un VICTOURY et l'alignement sur Ozon
    // paraît revenir en arrière à chaque rafraîchissement.
    const hasCode = (o) => !!String(o.trackingNumber || '').trim() || isVictCode(o.id);
    expect(hasCode({ id: 'WC-1', trackingNumber: 'WC-1959' })).toBe(true);
    expect(hasCode({ id: 'WC-2', trackingNumber: 'MIMA2125' })).toBe(true);
    expect(hasCode({ id: 'WC-3', trackingNumber: 'VICT00050' })).toBe(true);
    expect(hasCode({ id: 'WC-4', trackingNumber: '' })).toBe(false);
    expect(hasCode({ id: 'VICT0002', trackingNumber: '' })).toBe(true);
  });

  it('une commande portant un code Ozon n’en reçoit pas un second', () => {
    // Règle appliquée à la confirmation ET au rattrapage de démarrage.
    const hasCode = (o) => !!String(o.trackingNumber || '').trim() || isVictCode(o.id);
    expect(hasCode({ id: 'WC-2062', trackingNumber: 'WC-1959' })).toBe(true);
    expect(hasCode({ id: 'WC-2063', trackingNumber: 'MIMA3350' })).toBe(true);
    expect(hasCode({ id: 'WC-2064', trackingNumber: '   ' })).toBe(false);
  });

  it('la création du colis Ozon ne retombe pas sur l’identifiant WooCommerce', () => {
    // Reproduit le repli d'OzoneModal : quand Ozon ne renvoie pas de code, on
    // garde celui déjà porté par la commande — pas son identifiant (WC-2074),
    // qui remplacerait le code de suivi dans la Liste des Colis.
    const resolve = (data, order) =>
      data['TRACKING-NUMBER'] || data['tracking-number'] || order.trackingNumber || order.id;

    const order = { id: 'WC-2074', trackingNumber: 'VICTOURY0048' };
    expect(resolve({}, order)).toBe('VICTOURY0048');
    expect(resolve({ 'TRACKING-NUMBER': 'OZ-123' }, order)).toBe('OZ-123');
    // Sans code du tout, l'identifiant reste le dernier recours.
    expect(resolve({}, { id: 'WC-2074', trackingNumber: '' })).toBe('WC-2074');
  });

  it('ignore les codes de la Liste des Colis pour calculer le suivant', () => {
    // Un colis expédié porte un code hérité très au-dessus de la série : il ne
    // doit pas projeter la numérotation en avant (0048 -> 0146).
    const orders = [
      { id: 'WC-1', trackingNumber: 'VICTOURY0048', status: 'nouveau' },
      { id: 'WC-2', trackingNumber: 'VICTOURY0145', status: 'livre', validated: true },
    ];
    expect(generateVictId(orders)).toBe('VICTOURY0049');
  });

  it('saute un numéro déjà porté par un colis, sans créer de doublon', () => {
    const orders = [
      { id: 'WC-1', trackingNumber: 'VICTOURY0048', status: 'nouveau' },
      // 0049 et 0050 sont déjà pris par des colis expédiés.
      { id: 'WC-2', trackingNumber: 'VICTOURY0049', status: 'expedier', validated: true },
      { id: 'WC-3', trackingNumber: 'VICTOURY0050', status: 'livre', validated: true },
    ];
    expect(generateVictId(orders)).toBe('VICTOURY0051');
  });

  it('respecte le prochain numéro réglé, malgré un code erroné resté ailleurs', () => {
    // Un VICTOURY0145 oublié en « En Suivi » projetait la série à 0146.
    const orders = [
      { id: 'WC-1', trackingNumber: 'VICTOURY0050', status: 'nouveau' },
      { id: 'WC-2', trackingNumber: 'VICTOURY0145', status: 'pas_rep_1' },
    ];
    setNextNumber(51);
    expect(generateVictId(orders)).toBe('VICTOURY0051');
    expect(generateVictId(orders)).toBe('VICTOURY0052');
  });

  it('saute un numéro déjà pris même avec un point de départ réglé', () => {
    const orders = [{ id: 'WC-1', trackingNumber: 'VICTOURY0051', status: 'livre', validated: true }];
    setNextNumber(51);
    expect(generateVictId(orders)).toBe('VICTOURY0052');
  });

  it('émet des numéros distincts à la suite', () => {
    const orders = [];
    const a = generateVictId(orders);
    const b = generateVictId(orders);
    expect(a).toBe('VICTOURY0001');
    expect(b).toBe('VICTOURY0002');
  });
});
