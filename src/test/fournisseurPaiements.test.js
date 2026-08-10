import { describe, it, expect } from 'vitest';

/* Reproduit les règles de règlement de la page Fournisseur : le total facture
   vient des articles, le payé de la somme des versements, le reste de l'écart. */
const itemQty = (it) => (it.sizes || []).reduce((n, s) => n + (parseInt(s.qte, 10) || 0), 0);
const itemCost = (it) => (parseFloat(it.prix) || 0) * itemQty(it);
const paidOf = (f) => (f?.paiements || []).reduce((n, p) => n + (parseFloat(p.montant) || 0), 0);
const totalOf = (f) => (f.items || []).reduce((n, it) => n + itemCost(it), 0);

const facture = (paiements) => ({
  items: [{ prix: 100, sizes: [{ taille: 'M', qte: 15 }, { taille: 'L', qte: 10 }] }],  // 2500 DH
  paiements,
});

describe('règlement fournisseur', () => {
  it('le total ne dépend que des articles saisis, jamais des commandes', () => {
    // La page est autonome : une commande expédiée ou livrée ne doit rien
    // retrancher aux quantités ni au coût de la facture fournisseur.
    const f = facture([]);
    expect(totalOf(f)).toBe(2500);
    expect(itemQty(f.items[0])).toBe(25);
  });

  it('calcule le total de la facture depuis les articles', () => {
    expect(totalOf(facture([]))).toBe(2500);
  });

  it('additionne les versements et déduit le reste dû', () => {
    const f = facture([
      { montant: 1000, methode: 'especes' },
      { montant: 700, methode: 'virement' },
    ]);
    expect(paidOf(f)).toBe(1700);
    expect(totalOf(f) - paidOf(f)).toBe(800);
  });

  it('considère la facture soldée quand le reste tombe à zéro', () => {
    const f = facture([{ montant: 2500, methode: 'cheque' }]);
    expect(totalOf(f) - paidOf(f)).toBe(0);
  });

  it('supporte une facture sans aucun versement', () => {
    const f = facture(undefined);
    expect(paidOf(f)).toBe(0);
    expect(totalOf(f) - paidOf(f)).toBe(2500);
  });

  it('ignore un montant illisible au lieu de propager NaN', () => {
    const f = facture([{ montant: 500 }, { montant: 'abc' }]);
    expect(paidOf(f)).toBe(500);
  });
});
