import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/* `lib`, `data` et `hooks` sont regroupés dans un fichier à part au build (voir
 * vite.config.js). Ce regroupement n'est sûr que tant qu'aucun d'eux n'importe
 * un composant : sinon ce fichier renverrait vers le fichier principal, qui en
 * dépend déjà, et les deux s'attendraient l'un l'autre — une constante lue
 * avant d'exister, « Cannot access 'x' before initialization », sur une page au
 * hasard et en production seulement.
 *
 * La boucle est invisible dans le code source : elle ne se lit que dans le
 * bundle. Ce test garde la condition qui l'empêche. */
const SHARED_DIRS = ['src/lib', 'src/data', 'src/hooks'];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(js|jsx|ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe('fichier partagé du build', () => {
  const files = SHARED_DIRS.flatMap(walk);

  it('les dossiers partagés contiennent bien des modules', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  for (const file of files) {
    it(`${file} n’importe aucun composant`, () => {
      const src = readFileSync(file, 'utf8');
      const specs = [...src.matchAll(/from\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
      const dynamic = [...src.matchAll(/import\(\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
      const offenders = [...specs, ...dynamic].filter(spec => /(^|\/)components\//.test(spec));
      expect(offenders).toEqual([]);
    });
  }
});
