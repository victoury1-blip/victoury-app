import { describe, it, expect } from 'vitest';
import { ownProducts, isOwnProduct } from '../lib/affiliatePlatforms';

/* Le Stock héberge tout le catalogue — le sien et celui rapatrié des
   plateformes d'affiliation — et c'est ce qu'il faut pour le réassort. Mais la
   liste de choix d'une commande mélangeait les deux : une quinzaine d'articles
   qu'on ne vend pas soi-même s'intercalaient entre les siens, à chaque saisie. */
const catalogue = [
  { id: 1, name: 'Ensemble Sporte Noir' },
  { id: 'CHIC-489', name: 'Burkini Aurora', source: 'chic-affiliate' },
  { id: 2, name: 'Ensemble Sporte kaki', source: 'Manuel' },
  { id: 'BOUT-12', name: 'Srwal zara', source: 'bouait-affiliate' },
  { id: 'ALPH-7', name: 'Ensemble ALERTA', source: 'alphacod-affiliate' },
];

describe('catalogue proposé à la saisie d’une commande', () => {
  it('ne garde que ses propres articles', () => {
    expect(ownProducts(catalogue).map(p => p.name))
      .toEqual(['Ensemble Sporte Noir', 'Ensemble Sporte kaki']);
  });

  it('un article sans provenance est le sien', () => {
    // Les produits saisis à la main n'ont pas de champ « source ».
    expect(isOwnProduct({ name: 'Ensemble Sporte Rose' })).toBe(true);
  });

  it('écarte les articles de toutes les plateformes, pas d’une seule', () => {
    for (const source of ['chic-affiliate', 'bouait-affiliate', 'alphacod-affiliate']) {
      expect(isOwnProduct({ name: 'X', source })).toBe(false);
    }
  });

  it('supporte une liste absente', () => {
    expect(ownProducts(null)).toEqual([]);
    expect(ownProducts([])).toEqual([]);
  });
});
