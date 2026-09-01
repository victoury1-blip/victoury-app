import { describe, it, expect } from 'vitest';

/* Corriger le coût d'achat d'une commande : la quantité, jamais le prix.
 *
 * Le coût vaut prix unitaire × quantité. Quand une commande de deux articles
 * n'en déclarait qu'un, la tentation était de doubler le PRIX unitaire pour
 * retomber sur le bon total. Mais ce prix appartient au produit, partagé par
 * toutes ses commandes : la correction d'une seule en faussait quatre autres,
 * et l'une d'elles, remise à sa vraie valeur, effaçait la correction.
 */
const coutLigne = (prixUnitaire, qty) => prixUnitaire * qty;

/** Ce qu'écrit la correction de quantité sur une commande. */
function corrigerQuantite(order, index, value) {
  const qty = Math.max(1, Math.min(parseInt(value, 10) || 1, 999));
  const prods = order.products?.length ? order.products : (order.product ? [order.product] : []);
  if (!prods[index]) return order;
  const products = prods.map((p, i) => (i === index ? { ...p, qty } : p));
  return {
    ...order,
    products,
    product: index === 0 ? { ...(order.product || {}), ...products[0] } : order.product,
  };
}

describe('coût d’une ligne', () => {
  it('suit la quantité, à prix unitaire constant', () => {
    expect(coutLigne(100, 1)).toBe(100);
    expect(coutLigne(100, 2)).toBe(200);
    expect(coutLigne(100, 3)).toBe(300);
  });
});

describe('correction de la quantité', () => {
  const commande = {
    id: 'WC-2049',
    product: { name: 'Ensemble Sporte Noir', qty: 1 },
    products: [{ name: 'Ensemble Sporte Noir', qty: 1 }],
  };

  it('écrit la quantité sur la bonne ligne', () => {
    expect(corrigerQuantite(commande, 0, '2').products[0].qty).toBe(2);
  });

  it('tient à jour le produit principal, lu ailleurs dans l’application', () => {
    expect(corrigerQuantite(commande, 0, '2').product.qty).toBe(2);
  });

  it('ne touche pas aux autres lignes', () => {
    const deux = { id: 'X', products: [{ name: 'A', qty: 1 }, { name: 'B', qty: 1 }] };
    const out = corrigerQuantite(deux, 1, '3');
    expect(out.products.map(p => p.qty)).toEqual([1, 3]);
  });

  it('normalise une commande qui ne porte qu’un produit hors tableau', () => {
    // Sans cela la correction s'écrivait dans le vide.
    const seule = { id: 'Y', product: { name: 'A', qty: 1 } };
    expect(corrigerQuantite(seule, 0, '2').products).toEqual([{ name: 'A', qty: 2 }]);
  });

  it('refuse zéro, le vide et le négatif', () => {
    for (const v of ['0', '', '-3', 'abc']) {
      expect(corrigerQuantite(commande, 0, v).products[0].qty).toBe(1);
    }
  });
});

/* Un même article commandé deux fois s'écrit en DEUX lignes de commande, et non
   en quantité 2 : c'est ainsi que les commandes sont saisies. Le coût doit donc
   se lire sur la somme des lignes, sans quoi une commande de 440 DH n'en
   coûterait que 100. */
const coutCommande = (order, prixUnitaire) => {
  const prods = order.products?.length ? order.products : (order.product ? [order.product] : []);
  return prods.filter(p => p?.name).reduce((s, p) => s + prixUnitaire * (p.qty || 1), 0);
};

describe('commande à plusieurs lignes', () => {
  it('additionne deux lignes du même article', () => {
    const o = { products: [{ name: 'Ensemble Sporte Noir', qty: 1 }, { name: 'Ensemble Sporte Noir', qty: 1 }] };
    expect(coutCommande(o, 100)).toBe(200);
  });

  it('additionne deux articles différents', () => {
    const o = { products: [{ name: 'Ensemble Sporte Gris claire', qty: 1 }, { name: 'Ensemble Sporte Noir', qty: 1 }] };
    expect(coutCommande(o, 100)).toBe(200);
  });

  it('compte aussi les quantités, quand une ligne en porte une', () => {
    // Les deux écritures doivent donner le même total.
    expect(coutCommande({ products: [{ name: 'A', qty: 2 }] }, 100)).toBe(200);
  });

  it('ignore les lignes vides laissées dans une commande', () => {
    const o = { products: [{ name: 'A', qty: 1 }, { name: '', qty: 1 }] };
    expect(coutCommande(o, 100)).toBe(100);
  });
});
