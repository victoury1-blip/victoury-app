import { describe, it, expect, vi } from 'vitest';
vi.mock('../lib/supabase', () => ({ supabase: {} }));
import { versIso, versFr } from '../lib/photosFournisseur';

describe('date de prise du bon fournisseur', () => {
  it('JJ/MM/AAAA ↔ AAAA-MM-JJ', () => {
    expect(versIso('05/11/2026')).toBe('2026-11-05');
    expect(versFr('2026-11-05')).toBe('05/11/2026');
    expect(versIso('2026-11-05')).toBe('2026-11-05');
    expect(versIso('')).toBe('');
    expect(versFr('')).toBe('');
    expect(versIso(undefined)).toBe('');
  });
});
