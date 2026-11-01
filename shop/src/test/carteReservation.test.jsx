import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

// Lien simplifié : pas de routeur (lancé aussi depuis la racine du dépôt, où
// react-router-dom viendrait d'une autre copie de React).
vi.mock('react-router-dom', () => ({ Link: ({ children, to, ...p }) => <a href={to} {...p}>{children}</a> }));
vi.mock('../components/AvisProduit', () => ({ ResumeAvis: () => null }));
vi.mock('../components/BoutonFavori', () => ({ default: () => null }));
import CarteProduit from '../components/CarteProduit';
import { PrecommandesContexte } from '../lib/precommandesContexte';

const produit = { id: 'p1', slug: 'noir', name: 'Ensemble Sport Noir', price: 249, images: [], sizes: [{ size: 'L', stock: 0 }, { size: 'XL', stock: 0 }] };

async function rendre(precommandes) {
  const div = document.createElement('div');
  await act(async () => {
    createRoot(div).render(
      <PrecommandesContexte.Provider value={precommandes}><CarteProduit produit={produit} /></PrecommandesContexte.Provider>);
  });
  return div.textContent;
}

describe('carte produit en réservation', () => {
  it('remplace « épuisé » par la réservation et montre les tailles', async () => {
    const dans5j = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    const t = await rendre({ p1: { date: dans5j } });
    expect(t).toMatch(/Réservez votre taille|يمكن حجز قياسك/);
    expect(t).toContain('XL');
  });
  it('reste « épuisé » sans réservation', async () => {
    const t = await rendre({});
    expect(t).not.toMatch(/Réservez votre taille|يمكن حجز قياسك/);
  });
});
