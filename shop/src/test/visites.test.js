import { describe, it, expect, vi, beforeEach } from 'vitest';

const insert = vi.fn(() => Promise.resolve({}));
vi.mock('../lib/supabase', () => ({ supabase: { from: () => ({ insert }) } }));
import { estRobot, enregistrerVisite, enregistrerAjoutPanier, enregistrerEtapeFormulaire } from '../lib/visites';

describe('statistiques de visites', () => {
  beforeEach(() => { insert.mockClear(); sessionStorage.clear(); localStorage.clear(); window.history.pushState({}, '', '/'); });

  it('écarte les robots', () => {
    expect(estRobot('facebookexternalhit/1.1')).toBe(true);
    expect(estRobot('Mozilla/5.0 HeadlessChrome')).toBe(true);
    expect(estRobot('Mozilla/5.0 (Linux; Android 13) Instagram 300')).toBe(false);
  });

  it('une seule visite par onglet et par jour, avec un identifiant stable', () => {
    enregistrerVisite();
    enregistrerVisite();
    expect(insert).toHaveBeenCalledTimes(1);
    const ligne = insert.mock.calls[0][0];
    expect(ligne.type).toBe('visite');
    expect(ligne.visiteur.length).toBeGreaterThanOrEqual(8);
    expect(localStorage.getItem('victoury_visiteur')).toBe(ligne.visiteur);
  });

  it("ne compte pas l'administration", () => {
    window.history.pushState({}, '', '/store/commandes');
    enregistrerVisite();
    enregistrerAjoutPanier('X');
    expect(insert).not.toHaveBeenCalled();
  });

  it('enregistre un ajout au panier avec le produit', () => {
    enregistrerAjoutPanier('Ensemble Sport Taupe');
    expect(insert.mock.calls[0][0]).toMatchObject({ type: 'panier', produit: 'Ensemble Sport Taupe' });
  });

  it('note chaque étape du formulaire une seule fois', () => {
    enregistrerEtapeFormulaire('champ:telephone');
    enregistrerEtapeFormulaire('champ:telephone');
    enregistrerEtapeFormulaire('manque:adresse');
    expect(insert).toHaveBeenCalledTimes(2);
    expect(insert.mock.calls[1][0]).toMatchObject({ type: 'formulaire', produit: 'manque:adresse' });
  });
});
