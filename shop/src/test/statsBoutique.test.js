import { describe, it, expect, vi } from 'vitest';
vi.mock('../lib/supabase', () => ({ supabase: { from: () => ({ insert: () => Promise.resolve({}) }) } }));
import { periodePrecedente, variation, issueCommande, issuesCommandes, topProduits, commandesParHeure, heureMaroc } from '../lib/statsBoutique';
import { typeAppareil } from '../lib/visites';

describe('tableau de bord boutique', () => {
  it('période précédente de même durée', () => {
    const p = periodePrecedente(new Date(2026, 10, 3), new Date(2026, 10, 9, 23, 59));
    expect(p.jours).toBe(7);
    expect(p.start).toEqual(new Date(2026, 9, 27));
    expect(p.end.getDate()).toBe(2);
    const auj = periodePrecedente(new Date(2026, 10, 3), new Date(2026, 10, 3, 23, 59));
    expect(auj.start).toEqual(new Date(2026, 10, 2));
  });

  it('variation en %', () => {
    expect(variation(118, 100)).toBe(18);
    expect(variation(88, 100)).toBe(-12);
    expect(variation(5, 0)).toBe(null);
  });

  it('regroupe les statuts en 4 issues', () => {
    expect(issueCommande('nouveau')).toBe('attente');
    expect(issueCommande('pas_rep_3')).toBe('attente');
    expect(issueCommande('expedier')).toBe('confirmees');
    expect(issueCommande('livre')).toBe('livrees');
    expect(issueCommande('refuse')).toBe('perdues');
    const r = issuesCommandes([{ status: 'livre', price: 249 }, { status: 'livre', price: 499 }, { status: 'annule', price: 290 }, { status: 'confirme' }]);
    expect(r).toEqual({ attente: 0, confirmees: 1, livrees: 2, perdues: 1, caLivre: 748 });
  });

  it('classe les produits et les tailles', () => {
    const { produits, tailles } = topProduits([
      { products: [{ name: 'Ensemble Sport Noir', size: 'L', qty: 2 }, { name: 'Ensemble Hijab Sport Taupe', size: 'm', qty: 1 }] },
      { product: { name: 'Ensemble Sport Noir - L', size: 'L' } },
    ]);
    expect(produits[0]).toEqual(['Ensemble Sport Noir', 3]);
    expect(tailles[0]).toEqual(['L', 3]);
    expect(tailles[1]).toEqual(['M', 1]);
  });

  it('compte les commandes par heure du Maroc', () => {
    const d = new Date('2026-11-03T19:30:00Z'); // 20h30 au Maroc (UTC+1)
    expect(heureMaroc(d)).toBe(20);
    const r = commandesParHeure([{ t: d }, { t: d }], o => o.t);
    expect(r).toHaveLength(24);
    expect(r[20]).toEqual({ heure: '20h', commandes: 2 });
  });

  it('reconnaît le type d’appareil', () => {
    expect(typeAppareil('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe('mobile');
    expect(typeAppareil('Mozilla/5.0 (Linux; Android 13; SM-A536) Mobile')).toBe('mobile');
    expect(typeAppareil('Mozilla/5.0 (iPad; CPU OS 17_0)')).toBe('tablette');
    expect(typeAppareil('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('ordinateur');
  });
});
