import { describe, it, expect } from 'vitest';
import { ajouter, changerQuantite, retirer, cleLigne } from '../lib/panier';

const noir40 = { slug: 'ensemble-sporte-noir', name: 'Ensemble Sporte Noir', size: '40', price: 220, stock: 5 };
const noir42 = { ...noir40, size: '42' };

/* Le même modèle en deux tailles n'est pas le même article : les confondre
   ferait livrer la mauvaise pointure. */
describe('lignes du panier', () => {
  it('deux tailles font deux lignes', () => {
    const p = ajouter(ajouter([], noir40), noir42);
    expect(p).toHaveLength(2);
  });

  it('la même taille ajoutée deux fois n’en fait qu’une', () => {
    const p = ajouter(ajouter([], noir40), noir40);
    expect(p).toHaveLength(1);
    expect(p[0].qty).toBe(2);
  });

  it('identifie une ligne par produit et taille', () => {
    expect(cleLigne(noir40)).not.toBe(cleLigne(noir42));
  });
});

/* On ne vend pas ce qu'on n'a pas : accepter une quantité au-delà du stock
   promet une livraison impossible, et c'est le client qui l'apprend. */
describe('stock', () => {
  it('plafonne la quantité au stock de la taille', () => {
    expect(ajouter([], noir40, 12)[0].qty).toBe(5);
  });

  it('plafonne aussi en réajoutant', () => {
    let p = ajouter([], noir40, 4);
    p = ajouter(p, noir40, 4);
    expect(p[0].qty).toBe(5);
  });

  it('sans stock connu, garde une limite raisonnable', () => {
    expect(ajouter([], { ...noir40, stock: undefined }, 500)[0].qty).toBe(99);
  });
});

describe('modification', () => {
  it('change la quantité d’une ligne', () => {
    const p = changerQuantite(ajouter([], noir40), cleLigne(noir40), 3);
    expect(p[0].qty).toBe(3);
  });

  it('descendre à zéro retire la ligne', () => {
    // Plus lisible qu'une ligne à 0 qui traîne dans le récapitulatif.
    expect(changerQuantite(ajouter([], noir40), cleLigne(noir40), 0)).toEqual([]);
  });

  it('retire une ligne sans toucher aux autres', () => {
    const p = retirer(ajouter(ajouter([], noir40), noir42), cleLigne(noir40));
    expect(p.map(l => l.size)).toEqual(['42']);
  });
});
