import { describe, it, expect } from 'vitest';
import { groupeProduit, libelleGroupe } from '../lib/groupeProduit';

describe('groupe produit (coût d’achat)', () => {
  it('regroupe les couleurs d’un même modèle', () => {
    expect(groupeProduit('Ensemble Sport Noir')).toBe('ensemble sport');
    expect(groupeProduit('Ensemble Sporte Marron')).toBe('ensemble sport');
    expect(groupeProduit('Ensemble Sporte Gris foncé')).toBe('ensemble sport');
    expect(groupeProduit('Ensemble Hijab Sport gris')).toBe('ensemble hijab sport');
    expect(groupeProduit('Ensemble Hijab Vert sauge')).toBe('ensemble hijab sport');
    expect(libelleGroupe('ensemble hijab sport')).toBe('Ensemble Hijab Sport');
  });
});
