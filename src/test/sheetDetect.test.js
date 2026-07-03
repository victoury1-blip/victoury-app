import { describe, it, expect } from 'vitest';
import { looksLikePhone, looksLikePrice, hasHeaderRow, detectColumns } from '../lib/sheetDetect';

describe('looksLikePhone', () => {
  it('accepte les numéros marocains', () => {
    expect(looksLikePhone('0664569104')).toBe(true);
    expect(looksLikePhone('06 64 56 91 04')).toBe(true);
    expect(looksLikePhone('+212664569104')).toBe(true);
    expect(looksLikePhone('0712345678')).toBe(true);
  });
  it('rejette prix et texte', () => {
    expect(looksLikePhone('250')).toBe(false);
    expect(looksLikePhone('Rawiya')).toBe(false);
    expect(looksLikePhone('0912345678')).toBe(false);
  });
});

describe('looksLikePrice', () => {
  it('accepte les montants', () => {
    expect(looksLikePrice('250')).toBe(true);
    expect(looksLikePrice('115,00')).toBe(true);
    expect(looksLikePrice('35')).toBe(true);
  });
  it('rejette téléphone, date, texte', () => {
    expect(looksLikePrice('0664569104')).toBe(false);
    expect(looksLikePrice('2026-05-16')).toBe(false);
    expect(looksLikePrice('Fes')).toBe(false);
  });
});

describe('hasHeaderRow', () => {
  it('reconnaît une ligne d\'entêtes', () => {
    expect(hasHeaderRow(['Code', 'Nom', 'Telephone', 'Ville', 'Prix'])).toBe(true);
  });
  it('reconnaît l\'absence d\'entêtes (données réelles)', () => {
    expect(hasHeaderRow(['MIMA3345', 'Rawiya', '0664569104', 'Fes', '250'])).toBe(false);
  });
});

describe('detectColumns (CSV sans entêtes)', () => {
  // Reproduit le CSV du client : code | nom | tel | adresse | prix | ville | produit | date | taille | statut
  const headers = ['col1','col2','col3','col4','col5','col6','col7','col8','col9','col10'];
  const rows = [
    { col1:'MIMA3345', col2:'Rawiya',  col3:'0664569104', col4:'Ein sman hay wifaQ', col5:'250', col6:'Fes',        col7:'ENSEMBLE SPORT NOIR', col8:'2026-05-16', col9:'3XL', col10:'LIVRE' },
    { col1:'MIMA3346', col2:'Yassine', col3:'0652758903', col4:'Anza hay amal agadir', col5:'300', col6:'Agadir',    col7:'ENSEMBLE SPORT KAKI', col8:'2026-05-17', col9:'XL',  col10:'ANNULE' },
    { col1:'MIMA3347', col2:'Karim',   col3:'0678123456', col4:'Rue 12 quartier hassan', col5:'199', col6:'Rabat',  col7:'PACK SPORT BLEU',      col8:'2026-05-18', col9:'L',   col10:'RETOUR' },
  ];
  const cols = detectColumns(headers, rows);

  it('détecte téléphone, prix, ville, code', () => {
    expect(cols.phone).toBe('col3');
    expect(cols.price).toBe('col5');
    expect(cols.city).toBe('col6');
    expect(cols.code).toBe('col1');
  });
  it('détecte le statut', () => {
    expect(cols.status).toBe('col10');
  });
  it('assigne nom / adresse / produit dans l\'ordre', () => {
    expect(cols.name).toBe('col2');
    expect(cols.address).toBe('col4');
    expect(cols.product).toBe('col7');
  });
});
