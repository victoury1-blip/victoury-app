import { describe, it, expect } from 'vitest';
import { normalizeCity, findCityRow, feeFromRow } from '../lib/cityMatch';

const list = [
  { ville: 'Ain Atiq', livre: 20, refuse: 10, annule: 0, change: 25 },
  { ville: 'Ouarzazate', livre: 45, refuse: 10, annule: 0, change: 45 },
  { ville: 'Settat', livre: 35, refuse: 10, annule: 0, change: 35 },
  { ville: 'Marrakech', livre: 35, refuse: 10, annule: 0, change: 35 },
];

describe('normalizeCity', () => {
  /* Le cas qui a fait perdre le tarif : la commande écrit « Ain atik »,
     le transporteur « Ain Atiq ». */
  it('rapproche les transcriptions d’un même nom', () => {
    expect(normalizeCity('Ain atik')).toBe(normalizeCity('Ain Atiq'));
    expect(normalizeCity('Ouarzazate')).toBe(normalizeCity('Uarzazate'));
    expect(normalizeCity('Settat')).toBe(normalizeCity('Setat'));
    expect(normalizeCity('Ayt Melloul')).toBe(normalizeCity('Ait Meloul'));
    expect(normalizeCity('Salé')).toBe(normalizeCity('sale'));
  });

  it('ne confond pas deux villes distinctes', () => {
    expect(normalizeCity('Rabat')).not.toBe(normalizeCity('Ribat'));
    expect(normalizeCity('Fes')).not.toBe(normalizeCity('Safi'));
    expect(normalizeCity('Tanger')).not.toBe(normalizeCity('Tetouan'));
  });
});

describe('findCityRow', () => {
  it('trouve la ville malgré une orthographe différente', () => {
    expect(findCityRow(list, 'Ain atik')?.ville).toBe('Ain Atiq');
    expect(findCityRow(list, 'MARRAKECH')?.ville).toBe('Marrakech');
    expect(findCityRow(list, ' ouarzazate ')?.ville).toBe('Ouarzazate');
  });

  it('renvoie null quand la ville est absente ou vide', () => {
    expect(findCityRow(list, 'Ville inconnue')).toBeNull();
    expect(findCityRow(list, '')).toBeNull();
    expect(findCityRow([], 'Marrakech')).toBeNull();
  });

  /* Un fragment trop court trouvait n'importe quel nom qui le contient. */
  it('ne rapproche pas sur un fragment trop court', () => {
    expect(findCityRow([{ ville: 'Marrakech', livre: 35 }], 'Ma')).toBeNull();
  });
});

describe('feeFromRow', () => {
  const row = list[0];

  it('un échange se facture au tarif « change », même livré', () => {
    expect(feeFromRow(row, 'livre', true)).toBe(25);
    expect(feeFromRow(row, 'livre', false)).toBe(20);
  });

  it('reprend le tarif de livraison si le tarif d’échange manque', () => {
    expect(feeFromRow({ livre: 30 }, 'livre', true)).toBe(30);
  });

  it('suit le statut du colis hors échange', () => {
    expect(feeFromRow(row, 'refuse')).toBe(10);
    expect(feeFromRow(row, 'annule')).toBe(0);
    expect(feeFromRow(row, 'change')).toBe(25);
    expect(feeFromRow(null, 'livre')).toBeNull();
  });

  /* « Pas de tarif » et « tarif de zéro » sont deux choses différentes, et les
     confondre coûte de l'argent : une ville absente des tarifs retombait sur 0,
     la facture partait avec une livraison gratuite, et le profit affiché était
     plus haut que le vrai — sans que rien ne le signale. */
  it('distingue un tarif absent d’un tarif nul', () => {
    // Ville inconnue : rien à facturer AUTOMATIQUEMENT, il faut le dire.
    expect(feeFromRow(findCityRow(list, 'Ville inconnue'), 'livre')).toBeNull();
    // Tarif réellement saisi à zéro : c'est une décision, elle se respecte.
    expect(feeFromRow({ ville: 'Rabat', livre: 0 }, 'livre')).toBe(0);
    expect(feeFromRow({ ville: 'Rabat', livre: 0 }, 'livre')).not.toBeNull();
  });

  /* Un colis revenu à l'entrepôt garde l'issue constatée à la facture. Sans
     cela, un colis facturé « refusé » à 10 DH puis scanné au retour se voyait
     appliquer, au premier recalcul, le prix d'une livraison. */
  it('un retour ne se facture pas au prix d’une livraison', () => {
    expect(feeFromRow(row, 'retour_recu')).toBeNull();
    expect(feeFromRow(row, 'retour_recu')).not.toBe(row.livre);
    expect(feeFromRow(row, 'att_ramassage')).toBeNull();
  });

  it('un échange sans aucun tarif ne se facture pas à zéro en silence', () => {
    // L'échange doit être facturé : à défaut de tarif, c'est « inconnu », pas « gratuit ».
    expect(feeFromRow(null, 'change', true)).toBeNull();
    expect(feeFromRow({ ville: 'Fès' }, 'change', true)).toBeNull();
  });
});
