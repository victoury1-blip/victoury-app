import { describe, it, expect } from 'vitest';
import { decouperGras } from '../lib/texteEnrichi';

/* « Entourez un mot de *pour l'afficher en gras* » : la personne qui rédige un
   bandeau n'apprend pas une syntaxe, un astérisque de chaque côté suffit. */
describe('balisage gras du bandeau d’annonce', () => {
  it('sans astérisque, un seul morceau normal', () => {
    expect(decouperGras('Livraison gratuite')).toEqual([{ texte: 'Livraison gratuite', gras: false }]);
  });

  it('met en gras ce qui est entre astérisques', () => {
    expect(decouperGras('La 2ᵉ paire à *-20%*.')).toEqual([
      { texte: 'La 2ᵉ paire à ', gras: false },
      { texte: '-20%', gras: true },
      { texte: '.', gras: false },
    ]);
  });

  it('gère plusieurs segments en gras', () => {
    expect(decouperGras('*Livraison* offerte *dès 200 DH*')).toEqual([
      { texte: 'Livraison', gras: true },
      { texte: ' offerte ', gras: false },
      { texte: 'dès 200 DH', gras: true },
    ]);
  });

  it('un texte vide ne casse rien', () => {
    expect(decouperGras('')).toEqual([]);
    expect(decouperGras(undefined)).toEqual([]);
  });

  it('n’injecte jamais de balise HTML — seulement des morceaux de texte', () => {
    const morceaux = decouperGras('*<script>*');
    expect(morceaux.every(m => typeof m.texte === 'string')).toBe(true);
  });
});
