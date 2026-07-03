import { describe, it, expect } from 'vitest';
import { findOrderByCode, checkRamassageScan, checkRetourScan, RETOUR_ACCEPTED } from '../lib/scanUtils';

const orders = [
  { id: 'VICT0001', trackingNumber: 'BMD-123', ozoneTracking: 'OZ-999', status: 'att_ramassage' },
  { id: 'WC-1084', trackingNumber: '', status: 'refuse' },
  { id: 'VICT0002', trackingNumber: 'BMD-456', status: 'expedier' },
  { id: 'VICT0003', trackingNumber: 'BMD-789', status: 'livre' },
];

describe('findOrderByCode', () => {
  it('trouve par id exact', () => {
    expect(findOrderByCode(orders, 'VICT0001')?.id).toBe('VICT0001');
  });
  it('trouve par tracking', () => {
    expect(findOrderByCode(orders, 'BMD-123')?.id).toBe('VICT0001');
  });
  it('trouve par tracking Ozon', () => {
    expect(findOrderByCode(orders, 'OZ-999')?.id).toBe('VICT0001');
  });
  it('insensible à la casse', () => {
    expect(findOrderByCode(orders, 'vict0001')?.id).toBe('VICT0001');
    expect(findOrderByCode(orders, 'bmd-456')?.id).toBe('VICT0002');
  });
  it('ignore les espaces autour du code', () => {
    expect(findOrderByCode(orders, '  VICT0001  ')?.id).toBe('VICT0001');
  });
  it('retourne undefined si introuvable ou vide', () => {
    expect(findOrderByCode(orders, 'XXX')).toBeUndefined();
    expect(findOrderByCode(orders, '')).toBeUndefined();
    expect(findOrderByCode(orders, null)).toBeUndefined();
  });
});

describe('checkRamassageScan', () => {
  it('accepte att_ramassage', () => {
    expect(checkRamassageScan(orders[0])).toEqual({ ok: true });
  });
  it('rejette un colis déjà expédié', () => {
    expect(checkRamassageScan(orders[2])).toEqual({ ok: false, reason: 'deja_expedier' });
  });
  it('rejette tout autre statut', () => {
    expect(checkRamassageScan(orders[1])).toEqual({ ok: false, reason: 'statut_invalide' });
    expect(checkRamassageScan(orders[3])).toEqual({ ok: false, reason: 'statut_invalide' });
  });
  it('rejette une commande absente', () => {
    expect(checkRamassageScan(undefined)).toEqual({ ok: false, reason: 'not_found' });
  });
});

describe('checkRetourScan', () => {
  it('accepte retour, annule, echange, refuse', () => {
    for (const status of RETOUR_ACCEPTED) {
      expect(checkRetourScan({ status })).toEqual({ ok: true });
    }
  });
  it('rejette livré / expédié / att_ramassage', () => {
    expect(checkRetourScan({ status: 'livre' })).toEqual({ ok: false, reason: 'statut_invalide' });
    expect(checkRetourScan({ status: 'expedier' })).toEqual({ ok: false, reason: 'statut_invalide' });
    expect(checkRetourScan({ status: 'att_ramassage' })).toEqual({ ok: false, reason: 'statut_invalide' });
  });
  it('rejette une commande absente', () => {
    expect(checkRetourScan(undefined)).toEqual({ ok: false, reason: 'not_found' });
  });
});
