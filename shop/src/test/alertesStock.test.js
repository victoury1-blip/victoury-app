import { describe, it, expect } from 'vitest';
import { taillesEpuisees, nettoyerManques, cleTaille } from '../lib/alertesStock';

const produits = [
  { id: 'a', name: 'Ensemble Sport Bordeaux', status: 'Actif', collection: { name: 'Ensemble Sport' },
    sizes: [{ size: 'L', stock: 0, position: 2 }, { size: 'S', stock: 0, position: 0 }, { size: 'M', stock: 4, position: 1 }] },
  { id: 'b', name: 'Ensemble Sport Rouge', status: 'Archivé', collection: { name: 'Ensemble Sport' }, sizes: [{ size: 'S', stock: 0 }] },
  { id: 'c', name: 'Robe', status: 'Actif', collection: { name: 'Robes' }, sizes: [{ size: 'S', stock: 0 }] },
  { id: 'd', name: 'Ensemble Hijab Sport Noir', status: 'Actif', collection: { name: 'Ensemble Hijab Sport' }, sizes: [{ size: 'XL', stock: 5 }] },
];

describe('alertes de stock', () => {
  it('liste les tailles à 0 des ensembles actifs, dans l’ordre des tailles', () => {
    const r = taillesEpuisees(produits);
    expect(r.map(p => p.id)).toEqual(['a']);
    expect(r[0].epuisees.map(t => t.size)).toEqual(['S', 'L']);
  });

  it('cache les tailles marquées « manque de stock »', () => {
    const r = taillesEpuisees(produits, [cleTaille('a', 'S')]);
    expect(r[0].epuisees.map(t => t.size)).toEqual(['L']);
    expect(taillesEpuisees(produits, [cleTaille('a', 'S'), cleTaille('a', 'L')])).toEqual([]);
  });

  it('oublie le « manque » d’une taille réapprovisionnée', () => {
    expect(nettoyerManques(produits, [cleTaille('a', 'S'), cleTaille('a', 'M')])).toEqual([cleTaille('a', 'S')]);
  });
});
