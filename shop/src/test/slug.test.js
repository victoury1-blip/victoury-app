import { describe, it, expect } from 'vitest';
import { slugifier } from '../lib/slug';

/* L'adresse d'un produit est portée par les annonces en cours : elle doit
   sortir propre du premier coup, car la corriger ensuite arrêterait la
   publicité qui pointe dessus. */
describe('adresse d’un produit', () => {
  it('met en minuscules et remplace les espaces', () => {
    expect(slugifier('Ensemble Sporte Noir')).toBe('ensemble-sporte-noir');
  });

  it('retire les accents', () => {
    expect(slugifier('Robe Été Bleu Ciel')).toBe('robe-ete-bleu-ciel');
  });

  it('ne laisse ni ponctuation ni tirets en trop', () => {
    expect(slugifier('  Burkini — « Aurora » !!  ')).toBe('burkini-aurora');
  });

  it('supporte un nom écrit en arabe', () => {
    // Aucun caractère latin : mieux vaut une adresse vide qu'une suite de tirets.
    expect(slugifier('طقم رياضي')).toBe('');
  });

  it('borne la longueur', () => {
    expect(slugifier('a'.repeat(200)).length).toBeLessThanOrEqual(80);
  });
});
