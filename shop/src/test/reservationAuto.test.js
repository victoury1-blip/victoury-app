import { describe, it, expect } from 'vitest';
import { reservationTaille, reservationProduit, ajouterJours, cleRupture } from '../lib/precommande';

const now = new Date(2026, 10, 11, 10); // 11/11/2026
describe('réservation automatique', () => {
  it('ajoute des jours', () => {
    expect(ajouterJours('2026-11-28', 5)).toBe('2026-12-03');
  });
  it('rupture + 5 jours, par taille', () => {
    const pre = { p1: { auto: true, delai: 5 } };
    const ruptures = { [cleRupture('p1', 'XL')]: '2026-11-10' };
    expect(reservationTaille(pre, 'p1', 'XL', ruptures, now)).toBe('2026-11-15');
    // rupture pas encore notée : on part d'aujourd'hui
    expect(reservationTaille(pre, 'p1', 'S', ruptures, now)).toBe('2026-11-16');
    expect(reservationProduit(pre, 'p1', now)).toBe(true);
  });
  it('rupture ancienne sans réassort : jamais une date passée', () => {
    const pre = { p1: { auto: true } };
    expect(reservationTaille(pre, 'p1', 'M', { [cleRupture('p1', 'M')]: '2026-11-01' }, now)).toBe('2026-11-12');
  });
  it('date fixe : comportement inchangé', () => {
    const pre = { p2: { date: '2026-11-16' }, p3: { date: '2026-11-01' } };
    expect(reservationTaille(pre, 'p2', 'L', {}, now)).toBe('2026-11-16');
    expect(reservationTaille(pre, 'p3', 'L', {}, now)).toBe(null);
    expect(reservationProduit(pre, 'p3', now)).toBe(false);
    expect(reservationProduit({}, 'x', now)).toBe(false);
  });
});
