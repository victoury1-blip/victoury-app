import { describe, it, expect } from 'vitest';
import { analyserMessageClient, extraireTelephone, trouverVille, trouverTaille, trouverCouleur } from '../lib/messageClient';

const produits = [
  { name: 'Ensemble Sport Noir' }, { name: 'Ensemble Sport Marron' }, { name: 'Ensemble Sport Taupe' },
  { name: 'Ensemble Hijab Sport Noir' }, { name: 'Ensemble Sport kaki' },
];
const villes = ['Casablanca', 'Rabat', 'Marrakech', 'Tanger', 'Ksar El Kebir', 'Sidi Kacem', 'Tamellalt'];

describe('message WhatsApp → commande', () => {
  it('téléphone sous toutes ses formes', () => {
    expect(extraireTelephone('0612345678')).toBe('0612345678');
    expect(extraireTelephone('+212 6 12 34 56 78')).toBe('0612345678');
    expect(extraireTelephone('00212712345678')).toBe('0712345678');
    expect(extraireTelephone('٠٦١٢٣٤٥٦٧٨')).toBe('0612345678');
    expect(extraireTelephone('06.12.34.56.78')).toBe('0612345678');
    expect(extraireTelephone('prix 249 dh')).toBe(null);
  });

  it('message en darija (arabe), une seule ligne', () => {
    const r = analyserMessageClient('السلام، سميتي فاطمة الزهراء، 0612345678، الدار البيضاء حي السلام زنقة 5، بغيت الطقم الكحل XL', { villes, produits });
    expect(r.telephone).toBe('0612345678');
    expect(r.ville).toBe('Casablanca');
    expect(r.nom).toBe('فاطمة الزهراء');
    expect(r.adresse).toContain('حي السلام');
    expect(r.taille).toBe('XL');
    expect(r.couleur).toBe('Noir');
    expect(r.produit).toBe('Ensemble Sport Noir');
  });

  it('message sur plusieurs lignes (formulaire recopié)', () => {
    const r = analyserMessageClient('Hiba\n0625429330\nTamellalt\nIbissat 2 Tamellalt\nmarron taille L', { villes, produits });
    expect(r.nom).toBe('Hiba');
    expect(r.telephone).toBe('0625429330');
    expect(r.ville).toBe('Tamellalt');
    expect(r.taille).toBe('L');
    expect(r.produit).toBe('Ensemble Sport Marron');
  });

  it('darija en lettres latines, hijab', () => {
    const r = analyserMessageClient('slm smiti Salma, casa hay mohammadi derb 12, bghit hijab k7al 2XL, 0700112233', { villes, produits });
    expect(r.nom).toBe('Salma');
    expect(r.ville).toBe('Casablanca');
    expect(r.taille).toBe('2XL');
    expect(r.produit).toBe('Ensemble Hijab Sport Noir');
    expect(r.adresse).toContain('hay mohammadi');
  });

  it('villes composées et orthographe des livreurs', () => {
    expect(trouverVille('القصر الكبير حي المسيرة', villes)).toBe('Ksar El Kebir');
    expect(trouverVille('Qu jaouhara 1286 SIDI KACEM', villes)).toBe('Sidi Kacem');
    expect(trouverVille('rien ici', villes)).toBe(null);
  });

  it('ne prend pas n’importe quelle lettre pour une taille', () => {
    expect(trouverTaille('je veux le modèle')).toBe(null);
    expect(trouverTaille('مقاس m')).toBe('M');
    expect(trouverTaille('3xl')).toBe('3XL');
    expect(trouverCouleur('بغيت لون رمادي')).toBe('Gris');
  });
});
