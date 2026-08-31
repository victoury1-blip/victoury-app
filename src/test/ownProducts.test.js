import { describe, it, expect } from 'vitest';
import { ownProducts, isOwnProduct } from '../lib/affiliatePlatforms';
import { orderableProducts, isActiveProduct } from '../lib/orderProducts';

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

/* Cinq références — deux burkinis, un srwal, deux ensembles — venaient bien
   d'une plateforme, mais sans que leur provenance ait été enregistrée : aucune
   règle ne pouvait les distinguer des siennes. Le statut du Stock, lui, le dit
   déjà : « Archived » ou « Draft », un article ne se vend plus. */
describe('articles retirés de la vente', () => {
  it('un article archivé ou en brouillon n’est plus proposé', () => {
    const list = [
      { id: 1, name: 'Ensemble Sporte Noir', statut: 'Active' },
      { id: 2, name: 'Burkini Aurora', statut: 'Archived' },
      { id: 3, name: 'Srwal zara', statut: 'Draft' },
    ];
    expect(orderableProducts(list).map(p => p.name)).toEqual(['Ensemble Sporte Noir']);
  });

  it('un article sans statut reste actif', () => {
    // Les produits d'origine n'en portaient pas : les exclure viderait la liste.
    expect(isActiveProduct({ name: 'Ensemble Sporte Rose' })).toBe(true);
    expect(orderableProducts([{ id: 1, name: 'Ensemble Sporte Rose' }])).toHaveLength(1);
  });

  it('les deux exclusions se cumulent', () => {
    const list = [
      { id: 1, name: 'Ensemble Sporte Noir' },
      { id: 'CHIC-489', name: 'Burkini Aurora', source: 'chic-affiliate' },
      { id: 3, name: 'Ensemble ALERTA', statut: 'Archived' },
    ];
    expect(orderableProducts(list).map(p => p.name)).toEqual(['Ensemble Sporte Noir']);
  });
});
