import { describe, it, expect } from 'vitest';
import { fpRow, fpCached, staleIds } from '../lib/ordersSync';

const row = (over = {}) => ({
  id: 'A', status: 'nouveau', date_updated: '13/08/2026 10:00:00',
  tracking_number: 'VI00001', validated: false, recu: false, is_deleted: false, ...over,
});
const cached = (over = {}) => ({
  id: 'A', status: 'nouveau', dateUpdated: '13/08/2026 10:00:00',
  trackingNumber: 'VI00001', validated: false, recu: false, ...over,
});

describe('empreinte des commandes', () => {
  it('une ligne inchangée a la même empreinte des deux côtés', () => {
    expect(fpRow(row())).toBe(fpCached(cached()));
  });

  /* Ces équivalences sont la raison d'être de la normalisation : sans elle,
     chaque synchro croirait que TOUTES les commandes ont changé et rapatrierait
     la base entière — exactement ce qu'on cherche à éviter. */
  it('null et false sont équivalents pour un booléen', () => {
    expect(fpRow(row({ recu: null }))).toBe(fpCached(cached({ recu: false })));
    expect(fpRow(row({ validated: null }))).toBe(fpCached(cached({ validated: false })));
  });

  it('chaîne vide et null sont équivalents pour un code de suivi', () => {
    expect(fpRow(row({ tracking_number: '' }))).toBe(fpCached(cached({ trackingNumber: null })));
  });

  it('un changement de statut, de date ou de code modifie l’empreinte', () => {
    expect(fpRow(row({ status: 'confirme' }))).not.toBe(fpCached(cached()));
    expect(fpRow(row({ date_updated: '13/08/2026 10:00:01' }))).not.toBe(fpCached(cached()));
    expect(fpRow(row({ tracking_number: 'VI00002' }))).not.toBe(fpCached(cached()));
    expect(fpRow(row({ recu: true }))).not.toBe(fpCached(cached()));
  });
});

describe('staleIds', () => {
  const map = (list) => new Map(list.map(o => [o.id, o]));

  it('ne rapatrie rien quand tout est à jour', () => {
    expect(staleIds([row(), row({ id: 'B' })], map([cached(), cached({ id: 'B' })]))).toEqual([]);
  });

  it('rapatrie les commandes absentes du cache', () => {
    expect(staleIds([row(), row({ id: 'B' })], map([cached()]))).toEqual(['B']);
  });

  it('rapatrie uniquement les commandes modifiées', () => {
    const fps = [row(), row({ id: 'B', status: 'confirme' })];
    expect(staleIds(fps, map([cached(), cached({ id: 'B' })]))).toEqual(['B']);
  });
});
