import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
vi.mock('../lib/supabase', () => ({ supabase: { storage: { from: () => ({
  createSignedUrls: async (ps) => ({ data: ps.map(p => ({ path: p, signedUrl: 'https://x/' + p })), error: null }),
}) } } }));
vi.mock('../components/Toast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
import BonFournisseurModal from '../components/fournisseur/BonFournisseurModal';

describe('BonFournisseurModal', () => {
  it('affiche les photos et change la date de prise', async () => {
    const onDatePrise = vi.fn();
    render(<BonFournisseurModal
      facture={{ id: 'f1', ref: 'FRS-0022', date: '10/11/2026', datePrise: '08/11/2026', photos: [{ path: 'f1/a.jpg', nom: 'a.jpg', type: 'image' }] }}
      onClose={() => {}} onDatePrise={onDatePrise} onAjouterPhotos={() => {}} onRetirerPhoto={() => {}} />);
    expect(screen.getByText('Bon FRS-0022')).toBeTruthy();
    const champ = screen.getByDisplayValue('2026-11-08');
    fireEvent.change(champ, { target: { value: '2026-11-09' } });
    expect(onDatePrise).toHaveBeenCalledWith('09/11/2026');
    expect(await screen.findByAltText('a.jpg')).toBeTruthy();
  });
});
