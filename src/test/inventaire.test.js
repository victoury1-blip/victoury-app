import { describe, it, expect } from 'vitest';
import { inventaire, piecesDe } from '../lib/inventaire';

const cmd = (id, status, extra = {}) => ({ id, status, validated: true, trackingNumber: `T${id}`, dateAdded: '05/11/2026 10:00:00', products: [{ name: 'Ensemble Sport Noir', size: 'L', qty: 1 }], ...extra });

describe('où sont mes pièces', () => {
  it('compte les pièces, pas les commandes', () => {
    expect(piecesDe({ products: [{ name: 'A', qty: 2 }, { name: 'B', qty: 1 }] })).toBe(3);
    expect(piecesDe({ product: { name: 'A' } })).toBe(1);
  });

  it('répartit livraison, retours à récupérer et reçus', () => {
    const r = inventaire([
      cmd('VI1', 'expedier', { products: [{ name: 'A', qty: 2 }] }),
      cmd('VI2', 'recu_livreur'),
      cmd('VI3', 'refuse'),
      cmd('VI4', 'refuse', { recu: true }),
      cmd('VI5', 'annule'),
      cmd('VI6', 'livre'),
      cmd('VI7', 'expedier', { isDeleted: true }),
    ], new Set());
    expect(r.enLivraison).toEqual({ pieces: 3, colis: 2 });
    expect(r.refuses).toEqual({ aRecuperer: 1, recus: 1 });
    expect(r.annules).toEqual({ aRecuperer: 1, recus: 0 });
    expect(r.aRecuperer).toBe(2);
    expect(r.recus).toBe(1);
  });
});
