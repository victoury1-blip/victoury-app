import { describe, it, expect } from 'vitest';
import { suggererTaille, normaliserTaille, produitAvecGrille, tailleProduitCorrespondante } from '../lib/guideTailles';

describe('guide des tailles', () => {
  it('suggère selon le poids', () => {
    expect(suggererTaille(50, 160).taille).toBe('S');
    expect(suggererTaille(58, 160).taille).toBe('M');
    expect(suggererTaille(65, 160).taille).toBe('L');
    expect(suggererTaille(74, 160).taille).toBe('XL');
    expect(suggererTaille(82, 160).taille).toBe('2XL');
    expect(suggererTaille(95, 160).taille).toBe('3XL');
    expect(suggererTaille(120, 160).taille).toBe('3XL');
  });
  it('monte d’une taille si grande et en haut de plage', () => {
    expect(suggererTaille(61, 160).taille).toBe('M');
    expect(suggererTaille(61, 175).taille).toBe('L');
    expect(suggererTaille(56, 175).taille).toBe('M');
  });
  it('signale le bord de plage et refuse les valeurs absurdes', () => {
    expect(suggererTaille(61, 160).bord).toBe(true);
    expect(suggererTaille(56, 160).bord).toBe(false);
    expect(suggererTaille('', 160)).toBeNull();
    expect(suggererTaille(5, 160)).toBeNull();
  });
  it('normalise XXL / XXXL', () => {
    expect(normaliserTaille('xxl')).toBe('2XL');
    expect(normaliserTaille('XXXL')).toBe('3XL');
    expect(tailleProduitCorrespondante([{ size: 'XXL' }], '2XL')).toBe('XXL');
  });
  it('n’affiche le guide que pour les tailles S…3XL', () => {
    expect(produitAvecGrille([{ size: 'M' }])).toBe(true);
    expect(produitAvecGrille([{ size: '38' }, { size: '39' }])).toBe(false);
    expect(produitAvecGrille([])).toBe(false);
  });
});

import { grilleEffective, lirePlage, grilleEnTexte, GRILLE_TAILLES } from '../lib/guideTailles';
describe('grille réglable', () => {
  it('lit les plages tapées', () => {
    expect(lirePlage('40-54')).toEqual([40, 54]);
    expect(lirePlage('54 – 40')).toEqual([40, 54]);
    expect(lirePlage('abc')).toBeNull();
  });
  it('utilise la grille de l’admin (texte) et ignore les lignes vides', () => {
    const g = [{ taille: 'm', poids: '52-60', poitrine: '84-90' }, { taille: 'S', poids: '38-52' }, { taille: '', poids: '1-2' }];
    const e = grilleEffective(g);
    expect(e.map(x => x.taille)).toEqual(['S', 'M']);
    expect(suggererTaille(55, 160, g).taille).toBe('M');
    expect(e[0].poitrine).toBeNull();
  });
  it('retombe sur la grille standard si rien d’utilisable', () => {
    expect(grilleEffective(undefined)).toBe(GRILLE_TAILLES);
    expect(grilleEffective([{ taille: 'S', poids: 'x' }])).toBe(GRILLE_TAILLES);
    expect(grilleEnTexte(undefined)[0]).toEqual({ taille: 'S', poids: '40-54', poitrine: '80-86', tourTaille: '62-68', hanches: '86-92' });
  });
});
