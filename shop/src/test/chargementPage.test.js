import { describe, it, expect } from 'vitest';
import { estErreurDeChargement } from '../lib/chargementPage';

describe('chargement des pages', () => {
  it('reconnaît un fichier de page disparu après une mise en ligne', () => {
    expect(estErreurDeChargement(new TypeError('Failed to fetch dynamically imported module: https://x/assets/Reservations-abc.js'))).toBe(true);
    expect(estErreurDeChargement(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(estErreurDeChargement(new Error('Cannot read properties of undefined'))).toBe(false);
  });
});
