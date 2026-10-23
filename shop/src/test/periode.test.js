import { describe, it, expect } from 'vitest';
import { dansPeriode } from '../lib/periode';

const maintenant = new Date(2026, 9, 23, 23, 10); // 23/10/2026 23:10

describe('périodes', () => {
  it("aujourd'hui et hier", () => {
    expect(dansPeriode('23/10/2026 00:05:00', 'aujourdhui', maintenant)).toBe(true);
    expect(dansPeriode('22/10/2026 23:59:00', 'aujourdhui', maintenant)).toBe(false);
    expect(dansPeriode('22/10/2026 23:59:00', 'hier', maintenant)).toBe(true);
  });

  it('mois en cours et mois dernier', () => {
    expect(dansPeriode('01/10/2026 08:00:00', 'mois', maintenant)).toBe(true);
    expect(dansPeriode('30/09/2026 08:00:00', 'mois', maintenant)).toBe(false);
    expect(dansPeriode('30/09/2026 08:00:00', 'mois_dernier', maintenant)).toBe(true);
  });

  it('7 jours inclut aujourd’hui et les six jours d’avant', () => {
    expect(dansPeriode('17/10/2026 00:00:00', '7j', maintenant)).toBe(true);
    expect(dansPeriode('16/10/2026 23:00:00', '7j', maintenant)).toBe(false);
  });

  it('tout accepte tout', () => {
    expect(dansPeriode('', 'tout', maintenant)).toBe(true);
  });
});
