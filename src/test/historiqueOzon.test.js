import { describe, it, expect } from 'vitest';
import { historiqueOzon, issueOzon } from '../lib/historiqueOzon';

const colis = (id, phone, ozoneLastStatus, extra = {}) => ({ id, ozoneTracking: 'OZE' + id, ozoneLastStatus, recipient: { phone }, ...extra });

describe('historique Ozon d’un numéro', () => {
  it('lit le libellé Ozon', () => {
    expect(issueOzon('Livré')).toBe('livre');
    expect(issueOzon('LIVRE')).toBe('livre');
    expect(issueOzon('Retourné')).toBe('retourne');
    expect(issueOzon('Refusé')).toBe('retourne');
    expect(issueOzon('Annulé')).toBe('retourne');
    expect(issueOzon('En cours de livraison')).toBe('encours');
    expect(issueOzon('Mis en distribution')).toBe('encours');
    expect(issueOzon('Non livré - client injoignable')).toBe('encours');
    expect(issueOzon('')).toBe('encours');
  });

  it('compte seulement les colis Ozon du même numéro, sans la commande en cours', () => {
    const orders = [
      colis('A', '0663372556', 'Livré'),
      colis('B', '+212 663-372556', 'Livré'),
      colis('C', '0663372556', 'Retourné'),
      colis('D', '0663372556', 'Expédié'),
      colis('E', '0611111111', 'Livré'),
      { id: 'F', status: 'livre', recipient: { phone: '0663372556', delivery: 'Autre livreur' } },
      colis('G', '0663372556', 'Livré', { isDeleted: true }),
    ];
    expect(historiqueOzon(orders, '0663372556', 'D')).toEqual({ livres: 2, retournes: 1, encours: 0, total: 3 });
  });
});

import { niveauClientOzon } from '../lib/historiqueOzon';
describe('couleur du client', () => {
  it('vert / orange / rouge / nouveau', () => {
    expect(niveauClientOzon(0, 0).niveau).toBe('nouveau');
    expect(niveauClientOzon(2, 0)).toEqual({ niveau: 'vert', taux: 100 });
    expect(niveauClientOzon(3, 1)).toEqual({ niveau: 'vert', taux: 75 });
    expect(niveauClientOzon(1, 1)).toEqual({ niveau: 'orange', taux: 50 });
    expect(niveauClientOzon(2, 1).niveau).toBe('orange');
    expect(niveauClientOzon(0, 1)).toEqual({ niveau: 'rouge', taux: 0 });
    expect(niveauClientOzon(1, 2).niveau).toBe('rouge');
  });
});
