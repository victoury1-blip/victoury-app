import { describe, it, expect, beforeEach } from 'vitest';
import { fraisAffilie, rememberCityFrais, recallCityFrais, cityKey } from '../lib/affiliateFrais';

/* Le rapport de profit ne lisait que le frais figé sur la commande au moment de
   l'envoi. Une commande passée autrement — ou envoyée sans que le tarif soit
   renseigné — comptait une livraison à zéro, et son bénéfice était surestimé
   d'autant. La page Affiliations, elle, se rabattait déjà sur le tarif retenu
   pour la ville ; les deux suivent désormais la même règle. */
describe('frais d’une commande d’affiliation', () => {
  beforeEach(() => localStorage.clear());

  it('le montant figé à l’envoi prime', () => {
    rememberCityFrais('Casablanca', 25, 'chic');
    expect(fraisAffilie({ chicFrais: 40, recipient: { city: 'Casablanca' } }, 'chic')).toBe(40);
  });

  it('à défaut, reprend le tarif retenu pour la ville', () => {
    rememberCityFrais('Casablanca', 25, 'chic');
    expect(fraisAffilie({ recipient: { city: 'Casablanca' } }, 'chic')).toBe(25);
  });

  it('la ville se retrouve malgré la casse et les accents', () => {
    rememberCityFrais('Kénitra', 30, 'chic');
    expect(fraisAffilie({ recipient: { city: '  KENITRA ' } }, 'chic')).toBe(30);
    expect(cityKey('Kénitra')).toBe('kenitra');
  });

  it('un tarif introuvable est inconnu, pas gratuit', () => {
    // Rendre 0 le ferait passer pour une livraison offerte, et gonflerait le bénéfice.
    expect(fraisAffilie({ recipient: { city: 'Ville inconnue' } }, 'chic')).toBeNull();
    expect(fraisAffilie({}, 'chic')).toBeNull();
  });

  it('chaque plateforme garde ses propres tarifs', () => {
    rememberCityFrais('Rabat', 20, 'chic');
    expect(recallCityFrais('Rabat', 'chic')).toBe('20');
    expect(fraisAffilie({ recipient: { city: 'Rabat' } }, 'bouait')).toBeNull();
  });
});
