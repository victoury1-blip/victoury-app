import { describe, it, expect } from 'vitest';
import { estErreurReseau } from '../lib/erreurReseau';

describe('erreur réseau ou refus de la base', () => {
  it('coupure : à garder et renvoyer', () => {
    expect(estErreurReseau({ message: 'TypeError: Failed to fetch', code: '' }, true)).toBe(true);
    expect(estErreurReseau({ message: 'Load failed' }, true)).toBe(true);
    expect(estErreurReseau(new TypeError('NetworkError when attempting to fetch resource.'), true)).toBe(true);
    expect(estErreurReseau({ message: 'nimporte' }, false)).toBe(true);
  });
  it('refus de la base : pas de renvoi', () => {
    expect(estErreurReseau({ message: 'new row violates row-level security policy', code: '42501' }, true)).toBe(false);
    expect(estErreurReseau({ message: 'Numéro(s) déjà utilisé(s) en base' }, true)).toBe(false);
    expect(estErreurReseau(null, true)).toBe(false);
  });
});
