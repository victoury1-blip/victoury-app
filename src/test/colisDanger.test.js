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

import { extraireDate, libelleAvecDate } from '../lib/colisDanger';
describe('colis programmés / reportés', () => {
  it('lit la date et l’ajoute au libellé', () => {
    expect(extraireDate('Programmé pour le 2026-10-31')).toBe('2026-10-31');
    expect(extraireDate('reporté au 30/10/2026')).toBe('2026-10-30');
    expect(libelleAvecDate('Programmé', '2026-10-31')).toBe('Programmé 2026-10-31');
    expect(libelleAvecDate('Programmé 2026-10-31', '2026-11-02')).toBe('Programmé 2026-10-31');
    expect(libelleAvecDate('Livré', '2026-10-31')).toBe('Livré');
  });
  it('Programmé apparaît, avec la date dans le message', () => {
    expect(risqueStatut('Programmé 2026-10-31')).toMatchObject({ type: 'programme', niveau: 1 });
    const m = messageDanger({ ...base, ozoneLastStatus: 'Programmé 2026-10-31' }, 'programme');
    expect(m).toContain('نهار 31/10');
    expect(m).not.toMatch(/عافاك|عفاك/);
  });
});

import { messageLivreur } from '../lib/colisDanger';
describe('message au livreur', () => {
  it('donne la cliente, le téléphone et le colis', () => {
    const m = messageLivreur({ ...base, trackingNumber: 'VI00498', ozoneLastStatus: 'Pas de réponse J+3', recipient: { ...base.recipient, city: 'Tanger', address: 'Boulvared fes' } }, { nom: 'Tawfiq', tel: '0640504036' });
    expect(m).toContain('السلام عليكم Tawfiq');
    expect(m).toContain('معاك فريق Victoury');
    expect(m).toContain('👤 Sara');
    expect(m).toContain('📞 0612345678');
    expect(m).toContain('📦 VI00498 — Ensemble Sport Noir');
  });
});
