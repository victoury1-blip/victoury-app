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
    expect(r.enLivraison).toEqual({ pieces: 3, colis: 2, parStatut: { expedier: 1, recu_livreur: 1 } });
    expect(r.refuses).toEqual({ aRecuperer: 1, recus: 1 });
    expect(r.annules).toEqual({ aRecuperer: 1, recus: 0 });
    expect(r.aRecuperer).toBe(2);
    expect(r.recus).toBe(1);
  });
});

import { coutPiece, valeurs, argentChezLivreur } from '../lib/inventaire';

describe('valeur de la marchandise', () => {
  it('prix d’achat par modèle', () => {
    expect(coutPiece('Ensemble Hijab Vert sauge')).toBe(125);
    expect(coutPiece('Ensemble Sport Noir')).toBe(100);
    expect(coutPiece('Robe Tie-Dye', 90)).toBe(90);
  });

  it('valeur chez le livreur et à récupérer', () => {
    const v = valeurs([
      cmd('VI1', 'expedier', { price: 250 }),
      cmd('VI2', 'expedier', { price: 290, products: [{ name: 'Ensemble Hijab Sport Noir', qty: 1 }] }),
      cmd('VI3', 'refuse'),
    ], new Set(), 100);
    expect(v.livreur).toEqual({ achat: 225, vente: 540 });
    expect(v.aRecuperer.achat).toBe(100);
  });

  it('argent chez le livreur : livrés pas encore versés, depuis la 1re facture', () => {
    const factures = [
      { statut: 'paye', dateCreation: '01/11/2026 10:00:00', colis: [{ orderId: 'VI1' }] },
      { statut: 'en_attente', dateCreation: '04/11/2026 10:00:00', colis: [{ orderId: 'VI2' }] },
    ];
    const r = argentChezLivreur([
      cmd('VI1', 'livre', { price: 250 }),
      cmd('VI2', 'livre', { price: 290 }),
      cmd('VI3', 'livre', { price: 448 }),
      cmd('VI0', 'livre', { price: 999, dateAdded: '01/09/2026 10:00:00' }),
    ], factures);
    expect(r.montant).toBe(738);
    expect(r.colis).toBe(2);
    expect(r.dontFacture).toBe(290);
  });
});

describe('commandes importées de Google Sheets', () => {
  it('ne sont pas comptées', () => {
    const r = inventaire([
      { id: 'MIMA3002', trackingNumber: 'MIMA3002', status: 'expedier', products: [{ name: 'A', qty: 1 }] },
      { id: 'VI9', status: 'expedier', recipient: { importe: 'sheet' }, products: [{ name: 'A', qty: 1 }] },
      cmd('VI10', 'expedier'),
    ], new Set());
    expect(r.enLivraison.pieces).toBe(1);
  });
});
