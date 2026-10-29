import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

vi.mock('../lib/catalog', () => ({
  chargerProduit: vi.fn(async () => ({ group_id: 'g1', collection_id: 'h' })),
  chargerCollectionAvecTailles: vi.fn(async () => []),
  chargerCouleursAvecTailles: vi.fn(async () => [
    { id: 'c1', slug: 'noir', name: 'Hijab Noir', color_name: 'Noir', price: 290, collection_id: 'h', images: [], sizes: [{ size: 'L', stock: 3 }] },
    { id: 'c2', slug: 'gris', name: 'Hijab Gris', color_name: 'Gris', price: 290, collection_id: 'h', images: [], sizes: [{ size: 'L', stock: 0 }] },
    { id: 'c3', slug: 'beige', name: 'Hijab Beige', color_name: 'Beige', price: 290, collection_id: 'h', images: [], sizes: [{ size: 'L', stock: 2 }] },
  ]),
}));

import OffreLot from '../components/OffreLot';

const remises = [{ active: true, collectionId: 'h', paliers: [{ rang: 2, pourcent: 27.93 }] }];
const ligne = { slug: 'noir', name: 'Hijab Noir', price: 290, size: 'L', qty: 1, stock: 3, collectionId: 'h' };

async function rendre(props) {
  const div = document.createElement('div');
  await act(async () => { createRoot(div).render(<OffreLot {...props} />); });
  await act(async () => { await new Promise(r => setTimeout(r, 0)); });
  return div;
}

describe('offre en lot à la caisse', () => {
  it('propose la même pièce et les autres couleurs en stock dans la taille', async () => {
    const onQuantite = vi.fn(); const onAjouter = vi.fn();
    const div = await rendre({ lignes: [ligne], remises, onQuantite, onAjouter });
    expect(div.textContent).toContain('499');
    expect(div.textContent).toContain('Beige');
    expect(div.textContent).not.toContain('Gris'); // pas de stock en L
    const [meme, beige] = div.querySelectorAll('button');
    await act(async () => { meme.click(); });
    expect(onQuantite).toHaveBeenCalledWith('noir::L', 2);
    await act(async () => { beige.click(); });
    expect(onAjouter.mock.calls[0][0]).toMatchObject({ slug: 'beige', size: 'L', price: 290, collectionId: 'h' });
  });
  it('disparaît une fois l’offre atteinte', async () => {
    const div = await rendre({ lignes: [{ ...ligne, qty: 2 }], remises, onQuantite: () => {}, onAjouter: () => {} });
    expect(div.textContent).toBe('');
  });
});

import * as catalog from '../lib/catalog';
describe('offre en lot sans groupe de couleurs', () => {
  it('propose les autres articles de la collection dans la même taille', async () => {
    catalog.chargerProduit.mockResolvedValueOnce({ group_id: null, collection_id: 'h' });
    catalog.chargerCollectionAvecTailles.mockResolvedValueOnce([
      { id: 'r', slug: 'rouge', name: 'Ensemble Sport Rouge', color_name: null, price: 249, collection_id: 'h', images: [{ url: 'https://x/r.jpg' }], sizes: [{ size: 'L', stock: 4 }] },
    ]);
    const div = await rendre({ lignes: [ligne], remises, onQuantite: () => {}, onAjouter: () => {} });
    expect(div.textContent).toContain('Ensemble Sport Rouge');
    expect(div.querySelector('img')).not.toBeNull();
  });
});
