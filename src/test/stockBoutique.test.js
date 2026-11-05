import { describe, it, expect, vi } from 'vitest';
vi.mock('../lib/supabase', () => ({ supabase: {} }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({}) }));
import { lignesARetirer, normNom } from '../lib/stockBoutique';

const boutique = [
  { slug: 'ensemble-sporte-noir', name: 'Ensemble Sport Noir', sizes: [{ size: 'L', stock: 4 }, { size: 'XL', stock: 0 }] },
  { slug: 'ensemble-sporte-rose', name: 'Ensemble Sport Rose', sizes: [{ size: 'XXL', stock: 2 }] },
  { slug: 'ensemble-hijab-sport-noir', name: 'Ensemble Hijab Sport Noir', sizes: [{ size: 'M', stock: 3 }] },
];

describe('commande manuelle → stock de la boutique', () => {
  it('rapproche les noms (Sporte = Sport, accents, taille collée)', () => {
    expect(normNom('Ensemble Sporte Rose')).toBe(normNom('Ensemble Sport Rose'));
    expect(normNom('Ensemble Sport Noir - L')).toBe('ensemble sport noir');
  });

  it('retrouve produit et taille', () => {
    const r = lignesARetirer({ products: [
      { name: 'Ensemble Sport Noir', size: 'l', qty: 2 },
      { name: 'Ensemble Sporte Rose', size: 'XXL', qty: 1 },
      { name: 'Ensemble Hijab Sport Noir', size: 'M' },
    ] }, boutique);
    expect(r.aRetirer).toEqual([
      { slug: 'ensemble-sporte-noir', size: 'L', qty: 2 },
      { slug: 'ensemble-sporte-rose', size: 'XXL', qty: 1 },
      { slug: 'ensemble-hijab-sport-noir', size: 'M', qty: 1 },
    ]);
    expect(r.introuvables).toEqual([]);
  });

  it('signale ce qui n’existe pas sur le site', () => {
    const r = lignesARetirer({ products: [{ name: 'Robe Tie-Dye', size: 'M', qty: 1 }, { name: 'Ensemble Sport Noir', size: '4XL', qty: 1 }] }, boutique);
    expect(r.aRetirer).toEqual([]);
    expect(r.introuvables).toEqual(['Robe Tie-Dye (M)', 'Ensemble Sport Noir (4XL)']);
  });
});
