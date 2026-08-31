import { describe, it, expect } from 'vitest';

/* Fusion des prix d'achat saisis à la main entre appareils.
 *
 * La règle appliquée était « le local a le dernier mot » : un prix corrigé sur
 * le téléphone restait masqué sur l'ordinateur par l'ancienne valeur, et les
 * deux appareils affichaient durablement deux coûts d'achat — donc deux
 * profits, pour les mêmes commandes. Toute saisie partant aussitôt dans le
 * cloud, c'est lui qui fait foi. */
const fusion = (local, distant) => ({ ...local, ...distant });

describe('prix d’achat manuels partagés', () => {
  it('la valeur du cloud remplace celle restée sur l’appareil', () => {
    const local = { 'ensemble sporte noir': 100 };
    const distant = { 'ensemble sporte noir': 130 };
    expect(fusion(local, distant)['ensemble sporte noir']).toBe(130);
  });

  it('un prix connu du seul appareil n’est pas perdu', () => {
    const local = { 'burkini bleu': 90 };
    const distant = { 'robe rouge': 120 };
    expect(fusion(local, distant)).toEqual({ 'burkini bleu': 90, 'robe rouge': 120 });
  });

  it('sans rien dans le cloud, l’appareil garde ce qu’il a', () => {
    expect(fusion({ 'robe rouge': 120 }, {})).toEqual({ 'robe rouge': 120 });
  });
});
