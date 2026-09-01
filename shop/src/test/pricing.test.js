import { describe, it, expect } from 'vitest';
import { totalPanier, remiseQuantite, remisePromo, sousTotal, nbArticles } from '../lib/pricing';

const PALIERS = [{ rang: 2, pourcent: 20 }, { rang: 3, pourcent: 30 }];
const ligne = (price, qty = 1) => ({ price, qty });

describe('panier', () => {
  it('compte les articles, quantités comprises', () => {
    expect(nbArticles([ligne(200, 2), ligne(300)])).toBe(3);
    expect(sousTotal([ligne(200, 2), ligne(300)])).toBe(700);
  });
});

/* « La 2ᵉ paire à −20 %, la 3ᵉ à −30 % » porte sur les articles les MOINS
   chers : c'est la règle du commerce, et la seule défendable — appliquée aux
   plus chers, la même promesse coûterait davantage au marchand. */
describe('remise par quantité', () => {
  it('ne s’applique pas à un article seul', () => {
    expect(remiseQuantite([ligne(759)], PALIERS)).toBe(0);
  });

  it('remise le deuxième article, le moins cher', () => {
    // 759 et 500 → la remise porte sur 500, pas sur 759.
    expect(remiseQuantite([ligne(759), ligne(500)], PALIERS)).toBe(100);
  });

  it('cumule les paliers sur trois articles', () => {
    // 2ᵉ à −20 % puis 3ᵉ à −30 %, sur les deux moins chers.
    expect(remiseQuantite([ligne(759), ligne(759), ligne(759)], PALIERS))
      .toBe(759 * 0.2 + 759 * 0.3);
  });

  it('traite une quantité 2 comme deux articles', () => {
    expect(remiseQuantite([ligne(759, 2)], PALIERS)).toBe(759 * 0.2);
  });

  it('sans palier configuré, aucune remise', () => {
    expect(remiseQuantite([ligne(759), ligne(759)], [])).toBe(0);
  });
});

describe('code promo', () => {
  it('retire un pourcentage', () => {
    expect(remisePromo(1000, { kind: 'percent', value: 10 })).toBe(100);
  });

  it('retire un montant fixe', () => {
    expect(remisePromo(1000, { kind: 'amount', value: 150 })).toBe(150);
  });

  it('ne rend jamais le panier négatif', () => {
    // Un code de 500 DH sur un panier de 200 ne peut pas faire rendre 300 DH.
    expect(remisePromo(200, { kind: 'amount', value: 500 })).toBe(200);
  });
});

/* L'ordre des opérations est ce qui fait l'écart entre le total annoncé et le
   total facturé : quantité d'abord, code promo ensuite, livraison en dernier. */
describe('total', () => {
  it('applique le code promo APRÈS la remise par quantité', () => {
    const t = totalPanier([ligne(1000), ligne(1000)], {
      paliers: PALIERS, promo: { kind: 'percent', value: 10 },
    });
    expect(t.remiseQuantite).toBe(200);      // 2ᵉ à −20 %
    expect(t.remisePromo).toBe(180);         // 10 % de 1800, et non de 2000
    expect(t.total).toBe(1620);
  });

  it('ajoute la livraison en dernier, jamais remisée', () => {
    const t = totalPanier([ligne(200)], { livraison: 35, promo: { kind: 'percent', value: 50 } });
    expect(t.total).toBe(135); // 200 − 100 + 35
  });

  it('un panier vide vaut zéro', () => {
    expect(totalPanier([]).total).toBe(0);
  });

  it('ne descend jamais sous zéro', () => {
    const t = totalPanier([ligne(100)], { promo: { kind: 'amount', value: 999 } });
    expect(t.total).toBe(0);
  });
});
