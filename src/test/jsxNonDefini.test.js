/* Garde-fou : un composant utilisé dans le JSX mais jamais importé ne casse
 * PAS le build (Vite le laisse passer) — la page plante seulement chez
 * l'utilisateur (« X is not defined »). Ce test parcourt tout le code. */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse = traverseModule.default || traverseModule;
const racine = path.resolve(__dirname, '../..');

function fichiers(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    if (f === 'node_modules' || f === 'dist' || f === 'test') continue;
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) fichiers(p, out);
    else if (/\.(jsx|tsx)$/.test(f)) out.push(p);
  }
  return out;
}

describe('aucun composant JSX non défini', () => {
  it('application et boutique', () => {
    const problemes = [];
    for (const f of [...fichiers(path.join(racine, 'src')), ...fichiers(path.join(racine, 'shop/src'))]) {
      const ast = parse(fs.readFileSync(f, 'utf8'), { sourceType: 'module', plugins: ['jsx', 'typescript'] });
      traverse(ast, {
        JSXOpeningElement(p) {
          const n = p.node.name;
          if (n.type === 'JSXIdentifier' && /^[A-Z]/.test(n.name) && !p.scope.hasBinding(n.name)) {
            problemes.push(`${path.relative(racine, f)}:${n.loc.start.line} <${n.name}>`);
          }
        },
      });
    }
    expect(problemes).toEqual([]);
  });
});
