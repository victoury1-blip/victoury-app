import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/* Les modules regroupés dans le fichier « data-constants » (voir vite.config.js)
 * doivent rester des FEUILLES : sans import, ils ne peuvent refermer aucune
 * boucle entre fichiers générés.
 *
 * Une boucle se traduit par « Cannot access 'x' before initialization » sur une
 * page au hasard, en production seulement — introuvable autrement qu'en lisant
 * le bundle. Ce test garde la condition qui l'empêche. */
const LEAF_MODULES = [
  'src/lib/affiliatePlatforms.js',
  'src/lib/cityMatch.js',
  'src/data/colisPipeline.js',
];

describe('modules de constantes isolés', () => {
  for (const file of LEAF_MODULES) {
    it(`${file} n’importe rien`, () => {
      const src = readFileSync(file, 'utf8');
      const imports = src.match(/^\s*import\s.+from\s.+$/gm) || [];
      expect(imports).toEqual([]);
      expect(src).not.toMatch(/\bimport\s*\(/);
    });
  }

  it('la liste du test et celle de vite.config.js coïncident', () => {
    const cfg = readFileSync('vite.config.js', 'utf8');
    const block = cfg.slice(cfg.indexOf("'data-constants'"), cfg.indexOf('],', cfg.indexOf("'data-constants'")));
    for (const file of LEAF_MODULES) expect(block).toContain(`./${file}`);
    // Aucun module déclaré dans la config ne doit manquer ici.
    const declared = block.match(/'\.\/src\/[^']+'/g) || [];
    expect(declared.length).toBe(LEAF_MODULES.length);
  });
});
