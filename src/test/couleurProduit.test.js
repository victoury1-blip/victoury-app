import { describe, it, expect } from 'vitest';
import { modeleProduit, couleurProduit } from '../lib/couleurProduit';

describe('couleur produit', () => {
  it('ignore la couleur de l’article', () => {
    expect(modeleProduit('Ensemble Sport Noir')).toBe('ensemble sport');
    expect(modeleProduit('Ensemble Hijab Sport gris')).toBe('ensemble hijab sport');
    expect(couleurProduit('Ensemble Sport Noir')).toBe(couleurProduit('Ensemble Sport Gris'));
  });
  it('distingue les deux ensembles', () => {
    expect(couleurProduit('Ensemble Hijab Sport gris')).not.toBe(couleurProduit('Ensemble Sport Noir'));
  });
});
