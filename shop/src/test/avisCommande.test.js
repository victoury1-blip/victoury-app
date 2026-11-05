import { describe, it, expect } from 'vitest';
import { avisCommandeActif } from '../lib/avisCommande';

const avis = { actif: true, debut: '2026-11-06', fin: '2026-11-08', texteAr: 'نأكدو نهار الاثنين', texteFr: 'Confirmée lundi' };

describe('message de la caisse pendant une absence', () => {
  it('s’affiche seulement entre les dates', () => {
    expect(avisCommandeActif(avis, new Date('2026-11-05T22:00:00Z'))).toBe(null);
    expect(avisCommandeActif(avis, new Date('2026-11-06T08:00:00Z'))).toEqual({ texteAr: 'نأكدو نهار الاثنين', texteFr: 'Confirmée lundi' });
    expect(avisCommandeActif(avis, new Date('2026-11-08T23:30:00Z'))).not.toBe(null);
    expect(avisCommandeActif(avis, new Date('2026-11-09T00:30:00Z'))).toBe(null);
  });

  it('rien quand il est désactivé ou vide', () => {
    expect(avisCommandeActif({ ...avis, actif: false }, new Date('2026-11-07T10:00:00Z'))).toBe(null);
    expect(avisCommandeActif({ actif: true, texteAr: ' ', texteFr: '' })).toBe(null);
  });

  it('sans dates : toujours affiché', () => {
    expect(avisCommandeActif({ actif: true, texteFr: 'X' })).toEqual({ texteAr: 'X', texteFr: 'X' });
  });
});
