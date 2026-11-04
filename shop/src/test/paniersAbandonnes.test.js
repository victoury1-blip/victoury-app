import { describe, it, expect, vi } from 'vitest';
vi.mock('../lib/supabase', () => ({ supabase: {} }));
import { filtrerPaniersActifs } from '../lib/paniersAbandonnes';

describe('paniers abandonnés à relancer', () => {
  const paniers = [
    { id: 1, telephone: '0663372556', adresse: null, created_at: '2026-11-04T10:00:00Z' },
    { id: 2, telephone: '+212 663 372 556', adresse: 'Rue 1', created_at: '2026-11-04T10:02:00Z' },
    { id: 3, telephone: '0611111111', created_at: '2026-11-04T09:00:00Z' },
  ];

  it('garde le plus récent par téléphone', () => {
    const r = filtrerPaniersActifs(paniers, []);
    expect(r.map(p => p.id).sort()).toEqual([2, 3]);
  });

  it("une commande plus ancienne du même numéro ne masque pas le panier", () => {
    const r = filtrerPaniersActifs(paniers, [{ recipient: { phone: '0663372556' }, created_at: '2026-10-01T10:00:00Z' }]);
    expect(r.map(p => p.id)).toContain(2);
  });

  it('une commande passée après le panier le masque', () => {
    const r = filtrerPaniersActifs(paniers, [{ recipient: { phone: '0663372556' }, created_at: '2026-11-04T10:05:00Z' }]);
    expect(r.map(p => p.id)).toEqual([3]);
  });
});
