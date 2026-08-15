import { describe, it, expect } from 'vitest';
import { normalizePhone, samePhone } from '../lib/phoneUtils';

describe('normalizePhone', () => {
  it('normalizes +212 prefix to 0', () => {
    expect(normalizePhone('+212612345678')).toBe('0612345678');
  });

  it('normalizes 00212 prefix to 0', () => {
    expect(normalizePhone('00212612345678')).toBe('0612345678');
  });

  it('normalizes 212 prefix to 0', () => {
    expect(normalizePhone('212612345678')).toBe('0612345678');
  });

  it('strips spaces and dashes', () => {
    expect(normalizePhone('06 12-34 56 78')).toBe('0612345678');
  });

  it('handles empty input', () => {
    expect(normalizePhone('')).toBe('');
  });

  it('handles null input', () => {
    expect(normalizePhone(null)).toBe('');
  });

  it('handles undefined input', () => {
    expect(normalizePhone(undefined)).toBe('');
  });
});

/* Le cas qui déclenchait une fausse alerte « ce code d'envoi appartient à une
   autre commande » : le transporteur garde le zéro initial, la commande l'avait
   perdu en passant par un tableur. */
describe('samePhone', () => {
  it('reconnaît le même abonné malgré le zéro initial', () => {
    expect(samePhone('0723276261', '723276261')).toBe(true);
    expect(samePhone('+212723276261', '0723276261')).toBe(true);
    expect(samePhone('00212 723 276 261', '0723276261')).toBe(true);
  });

  it('distingue deux abonnés différents', () => {
    expect(samePhone('0723276261', '0723276262')).toBe(false);
    expect(samePhone('0612345678', '0712345678')).toBe(false);
  });

  it('ne conclut rien sur un numéro absent', () => {
    // Un numéro manquant ne prouve pas que le colis est celui d'un autre client.
    expect(samePhone('', '0723276261')).toBe(true);
    expect(samePhone('0723276261', null)).toBe(true);
  });
});
