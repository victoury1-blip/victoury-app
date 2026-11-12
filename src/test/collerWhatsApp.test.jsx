// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('../lib/supabase', () => ({ supabase: { from: () => ({ select: () => Promise.resolve({ data: [] }) }) } }));
vi.mock('../contexts/StatusContext', () => ({ useStatuses: () => ({ statuses: [{ value: 'nouveau', label: 'Nouveau' }] }) }));
vi.mock('../data/products', () => ({
  loadProducts: () => [
    { name: 'Ensemble Sport Noir', status: 'Actif', variations: [{ size: 'XL' }, { size: 'L' }] },
    { name: 'Ensemble Sport Marron', status: 'Actif', variations: [{ size: 'XL' }] },
  ],
  loadProductsRemote: () => Promise.resolve(null),
  SIZE_OPTIONS: ['S', 'M', 'L', 'XL', 'XXL', '3XL'], NUMERIC_SIZES: [],
}));

import NewOrderModal from '../components/orders/NewOrderModal';

describe('Coller depuis WhatsApp (fenêtre Nouvelle commande)', () => {
  it('remplit le formulaire à partir du message collé', async () => {
    localStorage.setItem('livreurs', JSON.stringify([{ id: 'oz', nom: 'Ozon Express' }]));
    localStorage.setItem('frais_oz', JSON.stringify([{ ville: 'Casablanca' }, { ville: 'Tanger' }]));
    render(<NewOrderModal onClose={() => {}} onSave={() => {}} orders={[]} />);
    const zone = screen.getByPlaceholderText(/Collez ici le message/);
    const msg = 'سميتي فاطمة، 0612345678، الدار البيضاء حي السلام زنقة 5، بغيت الكحل XL';
    await act(async () => {
      fireEvent.paste(zone, { clipboardData: { getData: () => msg } });
      await new Promise(r => setTimeout(r, 10));
    });
    expect(screen.getByPlaceholderText('Nom complet').value).toBe('فاطمة');
    expect(screen.getByPlaceholderText('+212...').value).toBe('0612345678');
    expect(screen.getByPlaceholderText('Adresse').value).toContain('حي السلام');
    expect(screen.getByText(/Ville : Casablanca/)).toBeTruthy();
    expect(screen.getByText(/Produit : Ensemble Sport Noir/)).toBeTruthy();
  });
});
