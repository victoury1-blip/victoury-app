import { describe, it, expect } from 'vitest';
import { precommandeActive, dateDispo, noteReservation, aujourdhui } from '../lib/precommande';
import { construireCommande } from '../lib/commande';

const maintenant = new Date(2026, 9, 28, 18, 30); // mercredi 28/10/2026

describe('précommande', () => {
  it('active jusqu’à la date d’arrivage incluse, puis s’éteint', () => {
    const resa = { p1: { date: '2026-11-02' } };
    expect(precommandeActive(resa, 'p1', maintenant)).toBe('2026-11-02');
    expect(precommandeActive(resa, 'p1', new Date(2026, 10, 2, 23, 0))).toBe('2026-11-02');
    expect(precommandeActive(resa, 'p1', new Date(2026, 10, 3, 0, 5))).toBeNull();
    expect(precommandeActive(resa, 'autre', maintenant)).toBeNull();
    expect(precommandeActive({ p1: { date: 'n’importe quoi' } }, 'p1', maintenant)).toBeNull();
    expect(precommandeActive(undefined, 'p1', maintenant)).toBeNull();
  });

  it('date du jour en heure locale', () => {
    expect(aujourdhui(maintenant)).toBe('2026-10-28');
  });

  it('formate la date avec le jour', () => {
    expect(dateDispo('2026-11-02')).toBe('lundi 02/11');
    expect(dateDispo('2026-11-02', true)).toBe('الاثنين 02/11');
  });

  it('ajoute la réservation à la note de la commande', () => {
    const lignes = [
      { slug: 'a', name: 'Ensemble Hijab Sport Noir', size: 'L', qty: 1, price: 290, precommande: '2026-11-02' },
      { slug: 'b', name: 'Ensemble Hijab Sport Gris', size: 'M', qty: 1, price: 290 },
    ];
    expect(noteReservation(lignes)).toBe('⏳ RÉSERVATION — Ensemble Hijab Sport Noir (L) : disponible le lundi 02/11');
    const c = construireCommande({ nom: 'A', telephone: '0612345678', ville: 'Rabat', adresse: 'x' }, lignes, 580, maintenant, 'VS-T');
    expect(c.note).toBe('Commande du site\n⏳ RÉSERVATION — Ensemble Hijab Sport Noir (L) : disponible le lundi 02/11');
    expect(c.products[0]).toEqual({ name: 'Ensemble Hijab Sport Noir', size: 'L', qty: 1 });
  });

  it('note inchangée sans réservation', () => {
    const c = construireCommande({ nom: 'A', telephone: '0612345678', ville: 'Rabat', adresse: 'x' },
      [{ slug: 'b', name: 'X', size: 'M', qty: 1, price: 1 }], 1, maintenant, 'VS-T');
    expect(c.note).toBe('Commande du site');
  });
});

import { infoReservation, reservationEnAttente, dateReservation, messageReservation } from '../lib/precommande';
describe('commandes réservées', () => {
  const ligne = { slug: 'a', name: 'Ensemble Sport Noir', size: 'XXL', qty: 1, price: 249, precommande: '2026-11-03' };
  it('pose la réservation sur la commande', () => {
    expect(infoReservation([ligne, { ...ligne, precommande: '2026-11-02' }])).toEqual({ date: '2026-11-03', envoyee: false });
    expect(infoReservation([{ ...ligne, precommande: undefined }])).toBeNull();
    const c = construireCommande({ nom: 'A', telephone: '0612345678', ville: 'Rabat', adresse: 'x' }, [ligne], 249, maintenant, 'VS-T');
    expect(c.recipient.reservation).toEqual({ date: '2026-11-03', envoyee: false });
    expect(reservationEnAttente(c)).toBe(true);
  });
  it('sort de l’attente une fois envoyée, ou si la commande a bougé', () => {
    const o = { status: 'nouveau', recipient: { reservation: { date: '2026-11-03', envoyee: true } } };
    expect(reservationEnAttente(o)).toBe(false);
    expect(reservationEnAttente({ status: 'confirme', recipient: { reservation: { envoyee: false } } })).toBe(false);
  });
  it('reconnaît les anciennes réservations à leur note', () => {
    const o = { status: 'nouveau', recipient: {}, note: 'Commande du site\n⏳ RÉSERVATION — Ensemble Sport Noir (XXL) : disponible le mardi 03/11' };
    expect(reservationEnAttente(o)).toBe(true);
    expect(dateReservation(o, maintenant)).toBe('2026-11-03');
  });
  it('message WhatsApp avec l’offre', () => {
    const o = { price: 249, recipient: { name: 'Sara', reservation: { date: '2026-11-03' } }, products: [{ name: 'Ensemble Sport Noir', size: 'XXL', qty: 1 }] };
    const m = messageReservation(o, 'جوج ب 448 درهم بلاصة 498 درهم');
    expect(m).toContain('السلام عليكم Sara');
    expect(m).toContain('• Ensemble Sport Noir — المقاس XXL');
    expect(m).toContain('🎁 عرض خاص: جوج ب 448 درهم');
    expect(m).toContain('نهار الثلاثاء 03/11');
    expect(m).toContain('نأكدو معاك الطلب');
  });
});
