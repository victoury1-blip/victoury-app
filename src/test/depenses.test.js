import { describe, it, expect } from 'vitest';
import { grouperParMois, libelleMois, moisPrecedent } from '../lib/depenses';

describe('dépenses par mois', () => {
  const liste = [
    { id: 1, label: 'ads 2/9', amount: 350, category: 'facebook', date: '2026-09-22' },
    { id: 2, label: '02/10', amount: 1500, category: 'facebook', date: '2026-10-16' },
    { id: 3, label: 'tiktok', amount: 200, category: 'tiktok', date: '2026-10-20' },
    { id: 4, label: 'ads 7/09', amount: 850, category: 'facebook', date: '2026-09-22' },
    { id: 5, label: 'vieux', amount: 10 },
  ];

  it('regroupe et totalise chaque mois, le plus récent en premier', () => {
    const g = grouperParMois(liste);
    expect(g.map(x => x.cle)).toEqual(['2026-10', '2026-09', 'sans-date']);
    expect(g[0].total).toBe(1700);
    expect(g[0].parCategorie).toEqual({ facebook: 1500, tiktok: 200 });
    expect(g[1].total).toBe(1200);
    expect(g[0].items.map(i => i.id)).toEqual([3, 2]);
  });

  it('nomme les mois en français', () => {
    expect(libelleMois('2026-11')).toBe('Novembre 2026');
    expect(libelleMois('sans-date')).toBe('Sans date');
  });

  it('passe d’un mois au précédent, y compris en janvier', () => {
    expect(moisPrecedent('2026-11')).toBe('2026-10');
    expect(moisPrecedent('2026-01')).toBe('2025-12');
  });
});
