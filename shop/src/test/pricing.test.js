import { describe, it, expect } from 'vitest';
import { totalPanier, remiseQuantite, remiseQuantiteGroupee, remisePromo, sousTotal, nbArticles } from '../lib/pricing';

const PALIERS = [{ rang: 2, pourcent: 20 }, { rang: 3, pourcent: 30 }];
const ligne = (price, qty = 1, collectionId) => ({ price, qty, collectionId });

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

/* Livraison gratuite au-delà d'un seuil : Volcano l'annonce, « livraison
   offerte dans tout le Royaume » au-dessus d'un montant. Le seuil se compare
   au montant APRÈS remises — pas au sous-total affiché sur la fiche — sinon un
   code promo pourrait faire garder une livraison gratuite déjà perdue. */
describe('seuil de livraison gratuite', () => {
  it('facture la livraison sous le seuil', () => {
    const t = totalPanier([ligne(150)], { livraison: 35, seuilGratuit: 200 });
    expect(t.livraison).toBe(35);
    expect(t.livraisonGratuite).toBe(false);
  });

  it('offre la livraison au-delà du seuil', () => {
    const t = totalPanier([ligne(250)], { livraison: 35, seuilGratuit: 200 });
    expect(t.livraison).toBe(0);
    expect(t.livraisonGratuite).toBe(true);
  });

  it('compare le seuil au montant après remises, pas au sous-total', () => {
    // 300 DH de sous-total, mais 210 après un code de 30% : reste au-dessus du
    // seuil de 200, la livraison reste gratuite.
    const t = totalPanier([ligne(300)], {
      livraison: 35, seuilGratuit: 200, promo: { kind: 'percent', value: 30 },
    });
    expect(t.livraison).toBe(0);
  });

  it('un code promo peut faire repasser sous le seuil', () => {
    // 250 DH de sous-total (au-dessus du seuil), mais 175 après 30% de remise :
    // la livraison redevient due, car c'est le montant payé qui compte.
    const t = totalPanier([ligne(250)], {
      livraison: 35, seuilGratuit: 200, promo: { kind: 'percent', value: 30 },
    });
    expect(t.livraison).toBe(35);
  });

  it('sans seuil configuré, la livraison reste toujours due', () => {
    expect(totalPanier([ligne(1000)], { livraison: 35 }).livraison).toBe(35);
  });
});

/* Le panier peut mélanger plusieurs collections : une remise réglée pour
   "Ensemble Sport" ne doit profiter qu'aux lignes de cette collection, pas à
   une robe achetée dans le même panier. */
describe('remise par quantité, groupée par collection', () => {
  const regle = (nom, collectionId) => ({ nom, active: true, collectionId, paliers: [{ rang: 2, pourcent: 20 }] });

  it("une règle ciblée ne remise que sa propre collection", () => {
    const remises = [regle('Sport -20%', 'sport')];
    const lignes = [ligne(500, 1, 'sport'), ligne(500, 1, 'sport'), ligne(500, 1, 'robes')];
    // 2 articles "sport" : le 2ᵉ à -20%. L'article "robes" n'a aucune remise.
    expect(remiseQuantiteGroupee(lignes, remises)).toBe(100);
  });

  it('une règle globale (sans collection) profite à tout le panier', () => {
    const remises = [regle('Toutes -20%', undefined)];
    const lignes = [ligne(500, 1, 'sport'), ligne(500, 1, 'robes')];
    expect(remiseQuantiteGroupee(lignes, remises)).toBe(100);
  });

  it('sans règle, aucune remise', () => {
    expect(remiseQuantiteGroupee([ligne(500, 2)], [])).toBe(0);
  });
});
