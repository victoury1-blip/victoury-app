import { describe, it, expect } from 'vitest';
import { historiqueClient, niveauClient, cleTelephone } from '../lib/historiqueClient';

const tel = (phone, status, id) => ({ id, status, recipient: { phone } });

describe('historique client', () => {
  it('reconnaît le même numéro sous plusieurs formes', () => {
    expect(cleTelephone('+212 696-076672')).toBe(cleTelephone('0696076672'));
  });

  it('compte livrés / refusés / annulés sans la commande en cours', () => {
    const orders = [
      tel('0696076672', 'livre', 'A'), tel('212696076672', 'refuse', 'B'), tel('0696076672', 'annule', 'C'),
      tel('0696076672', 'nouveau', 'D'), tel('0611111111', 'livre', 'E'),
      { ...tel('0696076672', 'livre', 'F'), is_deleted: true },
    ];
    const h = historiqueClient(orders, '0696076672', 'D');
    expect(h).toEqual({ livres: 1, refuses: 1, annules: 1, autres: 0, total: 3 });
    expect(niveauClient(h)).toBe('mitige');
  });

  it('niveaux', () => {
    expect(niveauClient(historiqueClient([], '0696076672'))).toBe('nouveau');
    expect(niveauClient(historiqueClient([tel('0696076672', 'livre', 'A')], '0696076672'))).toBe('fiable');
    expect(niveauClient(historiqueClient([tel('0696076672', 'refuse', 'A')], '0696076672'))).toBe('risque');
  });
});
