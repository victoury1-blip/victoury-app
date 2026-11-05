import { describe, it, expect, vi, beforeEach } from 'vitest';

const memoire = new Map();
vi.mock('../lib/cloudSettings', () => ({
  cloudGet: async (k) => memoire.get(k),
  cloudSet: async (k, v) => { memoire.set(k, v); },
  localGet: (k) => memoire.get(k),
}));
import { definirStockParModele, decrementerStockManuel, ajusterStockManuelSiConfirmeeModifiee, lireStockManuelCache, lireStockHijabCache, piecesHijab } from '../lib/stockManuel';

describe('stock au local par modèle', () => {
  beforeEach(() => memoire.clear());

  it('compte les pièces hijab d’une commande', () => {
    expect(piecesHijab({ products: [{ name: 'Ensemble Hijab Sport Noir', qty: 2 }, { name: 'Ensemble Sport Noir', qty: 1 }] })).toBe(2);
  });

  it('la saisie Sport / Hijab donne le total', async () => {
    await definirStockParModele({ sport: 300, hijab: 80 });
    expect(lireStockManuelCache()).toBe(380);
    expect(lireStockHijabCache()).toBe(80);
  });

  it('une confirmation baisse le total et la part hijab', async () => {
    await definirStockParModele({ sport: 300, hijab: 80 });
    await decrementerStockManuel({ products: [{ name: 'Ensemble Hijab Vert sauge', qty: 1 }, { name: 'Ensemble Sport Noir', qty: 2 }] });
    await new Promise(r => setTimeout(r, 0));
    expect(lireStockManuelCache()).toBe(377);
    expect(lireStockHijabCache()).toBe(79);
  });

  it('modifier une commande confirmée ajuste la différence', async () => {
    await definirStockParModele({ sport: 10, hijab: 10 });
    const avant = { status: 'confirme', products: [{ name: 'Ensemble Hijab Sport Noir', qty: 1 }] };
    const apres = { status: 'confirme', products: [{ name: 'Ensemble Hijab Sport Noir', qty: 3 }] };
    await ajusterStockManuelSiConfirmeeModifiee(avant, apres);
    await new Promise(r => setTimeout(r, 0));
    expect(lireStockManuelCache()).toBe(18);
    expect(lireStockHijabCache()).toBe(8);
  });
});
