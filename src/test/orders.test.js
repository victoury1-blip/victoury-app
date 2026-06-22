import { describe, it, expect } from 'vitest';
import { statusConfig, COLIS_STATUSES } from '../data/orders';

describe('statusConfig', () => {
  const requiredStatuses = [
    'nouveau', 'reporter', 'confirme', 'en_suivi', 'annule',
    'att_ramassage', 'expedier', 'recu_livreur', 'livre',
    'change', 'refuse', 'pas_rep_lv', 'pret_retour',
    'dem_suivi', 'injoignable', 'manque_stock',
  ];

  it('has all required statuses', () => {
    for (const status of requiredStatuses) {
      expect(statusConfig).toHaveProperty(status);
    }
  });

  it('each status has label and color properties', () => {
    for (const [key, value] of Object.entries(statusConfig)) {
      expect(value).toHaveProperty('label');
      expect(value).toHaveProperty('color');
      expect(typeof value.label).toBe('string');
      expect(typeof value.color).toBe('string');
    }
  });
});

describe('COLIS_STATUSES', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(COLIS_STATUSES)).toBe(true);
    expect(COLIS_STATUSES.length).toBeGreaterThan(0);
  });

  it('each status exists in statusConfig', () => {
    for (const status of COLIS_STATUSES) {
      expect(statusConfig).toHaveProperty(status);
    }
  });
});
