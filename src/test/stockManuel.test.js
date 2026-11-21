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

  it('les commandes ne touchent plus au stock au local (saisie manuelle uniquement)', async () => {
    await definirStockParModele({ sport: 300, hijab: 80 });
    await decrementerStockManuel({ products: [{ name: 'Ensemble Hijab Vert sauge', qty: 1 }, { name: 'Ensemble Sport Noir', qty: 2 }] });
    await ajusterStockManuelSiConfirmeeModifiee(
      { status: 'confirme', products: [{ name: 'Ensemble Hijab Sport Noir', qty: 1 }] },
      { status: 'confirme', products: [{ name: 'Ensemble Hijab Sport Noir', qty: 3 }] });
    await new Promise(r => setTimeout(r, 0));
    expect(lireStockManuelCache()).toBe(380);
    expect(lireStockHijabCache()).toBe(80);
  });
});
