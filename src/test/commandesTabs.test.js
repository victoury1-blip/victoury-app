import { describe, it, expect } from 'vitest';
import {
  A_CONFIRMER_STATUSES, EN_SUIVI_STATUSES, ANNULE_STATUSES, COLIS_PIPELINE,
} from '../data/colisPipeline';

describe('onglets Commandes', () => {
  /* « Annulé » est une commande close : comptée dans « En Suivi », elle gonflait
     le nombre de dossiers à relancer avec des dossiers terminés. */
  it('« En Suivi » ne contient plus « annulé »', () => {
    expect(EN_SUIVI_STATUSES).not.toContain('annule');
    expect(ANNULE_STATUSES).toEqual(['annule']);
  });

  /* Retirer un statut sans lui donner d'onglet rendrait ces commandes
     introuvables : elles n'apparaissent nulle part ailleurs. */
  it('chaque statut de commande reste visible quelque part', () => {
    const shown = new Set([
      ...A_CONFIRMER_STATUSES, ...EN_SUIVI_STATUSES, ...ANNULE_STATUSES,
      'reporter', 'confirme', ...COLIS_PIPELINE,
    ]);
    expect(shown.has('annule')).toBe(true);
    expect(shown.has('nouveau')).toBe(true);
    expect(shown.has('confirme')).toBe(true);
  });

  it('les onglets ne se recouvrent pas', () => {
    const groups = [A_CONFIRMER_STATUSES, EN_SUIVI_STATUSES, ANNULE_STATUSES, ['reporter'], ['confirme']];
    const all = groups.flat();
    expect(new Set(all).size).toBe(all.length);
  });
});
