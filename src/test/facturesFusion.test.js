import { describe, it, expect, vi } from 'vitest';
vi.mock('../lib/supabase', () => ({ supabase: {} }));
vi.mock('../lib/cloudSettings', () => ({ cloudGet: async () => null, cloudSet: async () => {} }));
import { fusionnerFactures } from '../data/factures';

describe('factures sur plusieurs appareils', () => {
  it('garde la facture créée sur un autre téléphone', () => {
    const ici = [{ id: 'a', ref: 'FCT-1', majLe: 1 }];
    const cloud = [{ id: 'a', ref: 'FCT-1', majLe: 1 }, { id: 'b', ref: 'FCT-2', majLe: 5 }];
    expect(fusionnerFactures(ici, cloud).map(f => f.id).sort()).toEqual(['a', 'b']);
  });
  it('la modification la plus récente gagne', () => {
    const ici = [{ id: 'a', statut: 'paye', majLe: 10 }];
    const cloud = [{ id: 'a', statut: 'en_attente', majLe: 3 }];
    expect(fusionnerFactures(ici, cloud)[0].statut).toBe('paye');
    expect(fusionnerFactures(cloud, ici)[0].statut).toBe('paye');
  });
  it('une facture supprimée ne revient pas', () => {
    expect(fusionnerFactures([{ id: 'a' }], [{ id: 'a' }, { id: 'b' }], ['a']).map(f => f.id)).toEqual(['b']);
  });
});
