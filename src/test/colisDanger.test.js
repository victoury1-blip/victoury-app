import { describe, it, expect } from 'vitest';
import { risqueStatut, risqueColis, dejaTraite, messageDanger } from '../lib/colisDanger';

const base = { id: 'VS-1', status: 'expedier', recipient: { name: 'Sara', delivery: 'Ozon Express', phone: '0612345678' }, products: [{ name: 'Ensemble Sport Noir', size: 'L', qty: 1 }] };

describe('colis en danger', () => {
  it('reconnaît les statuts Ozon à risque', () => {
    expect(risqueStatut('Pas de réponse + SMS')).toMatchObject({ type: 'injoignable', niveau: 2 });
    expect(risqueStatut('Pas de réponse J+3')).toMatchObject({ type: 'injoignable', niveau: 3 });
    expect(risqueStatut('pas réponse + déplacement J+2')).toMatchObject({ type: 'injoignable' });
    expect(risqueStatut('Refusé')).toMatchObject({ type: 'refus', niveau: 3 });
    expect(risqueStatut('Erreur Numero')).toMatchObject({ type: 'numero' });
    expect(risqueStatut('sans adresse')).toMatchObject({ type: 'adresse' });
    expect(risqueStatut('Hors-zone')).toMatchObject({ type: 'zone' });
    expect(risqueStatut('Zone Non-couverte')).toMatchObject({ type: 'zone' });
    expect(risqueStatut('reporté aujourd hui')).toMatchObject({ type: 'reporte', niveau: 1 });
    expect(risqueStatut('Livré')).toBeNull();
    expect(risqueStatut('Mise en distribution')).toBeNull();
  });
  it('seulement pour un colis Ozon encore en route', () => {
    expect(risqueColis({ ...base, ozoneLastStatus: 'Pas de réponse + SMS' })).not.toBeNull();
    expect(risqueColis({ ...base, status: 'livre', ozoneLastStatus: 'Pas de réponse + SMS' })).toBeNull();
    expect(risqueColis({ ...base, recipient: { ...base.recipient, delivery: 'Livreur Karim' }, ozoneLastStatus: 'Refusé' })).toBeNull();
  });
  it('un nouveau statut à risque fait réapparaître un colis traité', () => {
    const o = { ...base, ozoneLastStatus: 'Pas de réponse + SMS' };
    expect(dejaTraite(o, { 'VS-1': 'Pas de réponse + SMS' })).toBe(true);
    expect(dejaTraite({ ...o, ozoneLastStatus: 'Pas de réponse J+2' }, { 'VS-1': 'Pas de réponse + SMS' })).toBe(false);
  });
  it('message WhatsApp adapté', () => {
    const m = messageDanger(base, 'injoignable');
    expect(m).toContain('السلام عليكم Sara');
    expect(m).toContain('Ensemble Sport Noir');
    expect(m).toContain('يدوز اليوم');
  });
});
