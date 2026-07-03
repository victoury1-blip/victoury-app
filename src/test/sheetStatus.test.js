import { describe, it, expect } from 'vitest';
import { mapToAppStatus } from '../lib/sheetStatus';

describe('mapToAppStatus', () => {
  it('detecte Livré et variantes', () => {
    expect(mapToAppStatus('Livré')).toBe('livre');
    expect(mapToAppStatus('livre')).toBe('livre');
    expect(mapToAppStatus('LIVREE')).toBe('livre');
    expect(mapToAppStatus('delivered')).toBe('livre');
  });
  it('detecte Annulé', () => {
    expect(mapToAppStatus('Annulé')).toBe('annule');
    expect(mapToAppStatus('annuler')).toBe('annule');
    expect(mapToAppStatus('cancelled')).toBe('annule');
  });
  it('detecte Refusé', () => {
    expect(mapToAppStatus('Refusé')).toBe('refuse');
    expect(mapToAppStatus('refused')).toBe('refuse');
  });
  it('detecte Retour', () => {
    expect(mapToAppStatus('Retour')).toBe('retour_recu');
    expect(mapToAppStatus('retourné')).toBe('retour_recu');
    expect(mapToAppStatus('returned')).toBe('retour_recu');
  });
  it('detecte Échange / Confirmé / Expédié', () => {
    expect(mapToAppStatus('échange')).toBe('change');
    expect(mapToAppStatus('Confirmé')).toBe('confirme');
    expect(mapToAppStatus('Expédié')).toBe('expedier');
  });
  it('detecte Reçu (par livreur) et Pas de réponse abrégé', () => {
    expect(mapToAppStatus('RECU')).toBe('recu_livreur');
    expect(mapToAppStatus('reçu')).toBe('recu_livreur');
    expect(mapToAppStatus('PAS.R.1')).toBe('pas_reponse');
    expect(mapToAppStatus('EN ATTENTE')).toBe('en_attente');
  });
  it('detecte statuts arabes', () => {
    expect(mapToAppStatus('تم التسليم')).toBe('livre');
    expect(mapToAppStatus('ملغى')).toBe('annule');
    expect(mapToAppStatus('مرجع')).toBe('retour_recu');
  });
  it('retourne null si vide ou inconnu', () => {
    expect(mapToAppStatus('')).toBeNull();
    expect(mapToAppStatus(null)).toBeNull();
    expect(mapToAppStatus('xyz123')).toBeNull();
  });
});
