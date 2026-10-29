import { describe, it, expect } from 'vitest';
import { modeleProduit, couleurProduit } from '../lib/couleurProduit';

describe('couleur produit', () => {
  it('ignore la couleur de l’article', () => {
    expect(modeleProduit('Ensemble Sport Noir')).toBe('ensemble sport');
    expect(modeleProduit('Ensemble Hijab Sport gris')).toBe('ensemble hijab sport');
    expect(couleurProduit('Ensemble Sport Noir')).toBe(couleurProduit('Ensemble Sport Gris'));
  });
  it('teintes fixes des ensembles', () => {
    expect(couleurProduit('Ensemble Sport Noir')).toBe('#111827');
    expect(couleurProduit('Ensemble Sporte Marron')).toBe('#111827');
    expect(couleurProduit('Ensemble Hijab Sport gris')).toBe('#65A30D');
    expect(couleurProduit('Ensemble Hijab Vert sauge')).toBe('#65A30D');
    expect(couleurProduit('Ensemble Sporte Vert')).toBe('#111827');
  });
});
