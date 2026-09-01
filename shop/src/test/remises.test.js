import { describe, it, expect } from 'vitest';
import { paliersEffectifs } from '../lib/remises';

const regle = (nom, active, paliers) => ({ nom, active, paliers });

/* Plusieurs remises nommées peuvent coexister — saison, collection — mais ce
   que paie réellement le client ne dépend que de celles qui sont ACTIVES. */
describe('remises effectives', () => {
  it('ignore les règles désactivées', () => {
    const remises = [regle('Ancienne', false, [{ rang: 2, pourcent: 50 }])];
    expect(paliersEffectifs(remises)).toEqual([]);
  });

  it('applique une règle active seule', () => {
    const remises = [regle('2ème -20%', true, [{ rang: 2, pourcent: 20 }, { rang: 3, pourcent: 30 }])];
    expect(paliersEffectifs(remises)).toEqual([{ rang: 2, pourcent: 20 }, { rang: 3, pourcent: 30 }]);
  });

  it('garde la remise la plus avantageuse en cas de chevauchement', () => {
    // Deux règles actives sur le même rang : jamais leur somme, qui dépasserait
    // ce qui a été annoncé au client.
    const remises = [
      regle('Standard', true, [{ rang: 2, pourcent: 20 }]),
      regle('Promo sandales', true, [{ rang: 2, pourcent: 35 }]),
    ];
    expect(paliersEffectifs(remises)).toEqual([{ rang: 2, pourcent: 35 }]);
  });

  it('ignore un rang invalide (1 ou absent)', () => {
    const remises = [regle('X', true, [{ rang: 1, pourcent: 90 }, { rang: 2, pourcent: 20 }])];
    expect(paliersEffectifs(remises)).toEqual([{ rang: 2, pourcent: 20 }]);
  });

  it('sans aucune règle, aucune remise', () => {
    expect(paliersEffectifs([])).toEqual([]);
    expect(paliersEffectifs(undefined)).toEqual([]);
  });
});
