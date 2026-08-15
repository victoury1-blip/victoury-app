import { describe, it, expect } from 'vitest';
import {
  A_CONFIRMER_STATUSES, EN_SUIVI_STATUSES, ANNULE_STATUSES, COLIS_PIPELINE,
} from '../data/colisPipeline';
import { ORDER_TABS, tabFromParam, tabToParam, tabPath } from '../data/orderTabs';

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

/* La table qui traduit l'adresse en onglet était une QUATRIÈME copie de la
   liste. « Annulé » y manquait : /commandes/annule ouvrait « À Confirmer »,
   sans erreur ni indice. */
describe('adresses des onglets', () => {
  it('chaque onglet est atteignable par son adresse', () => {
    for (const t of ORDER_TABS) {
      expect(tabFromParam(tabToParam(t.id))).toBe(t.id);
      expect(tabPath(t.id)).toBe(`/commandes/${tabToParam(t.id)}`);
    }
  });

  it('une adresse inconnue retombe sur le premier onglet', () => {
    expect(tabFromParam('nimporte-quoi')).toBe(ORDER_TABS[0].id);
    expect(tabFromParam('')).toBe(ORDER_TABS[0].id);
    expect(tabFromParam(undefined)).toBe(ORDER_TABS[0].id);
  });

  it('« Annulé » a bien son onglet', () => {
    expect(ORDER_TABS.map(t => t.id)).toContain('annule');
    expect(tabFromParam('annule')).toBe('annule');
  });
});
