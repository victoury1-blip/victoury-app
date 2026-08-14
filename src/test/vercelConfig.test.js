import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/* Vercel valide strictement ce fichier et REFUSE tout déploiement qui contient
 * une clé inconnue — un commentaire ajouté dans une règle a suffi à mettre le
 * site hors ligne, sans que rien ne le signale avant la mise en production. */
const cfg = JSON.parse(readFileSync('vercel.json', 'utf8'));

const ROOT_KEYS = new Set([
  'functions', 'headers', 'rewrites', 'redirects', 'routes', 'cleanUrls',
  'trailingSlash', 'regions', 'buildCommand', 'outputDirectory', 'framework',
  'installCommand', 'devCommand', 'crons', 'images', 'git', 'public', 'ignoreCommand',
]);
const RULE_KEYS = new Set(['source', 'has', 'missing', 'headers', 'destination', 'permanent', 'statusCode']);

describe('vercel.json', () => {
  it('n’a que des clés reconnues à la racine', () => {
    expect(Object.keys(cfg).filter(k => !ROOT_KEYS.has(k))).toEqual([]);
  });

  it('n’a que des clés reconnues dans chaque règle', () => {
    for (const section of ['headers', 'rewrites', 'redirects']) {
      for (const rule of cfg[section] || []) {
        expect(Object.keys(rule).filter(k => !RULE_KEYS.has(k))).toEqual([]);
      }
    }
  });

  /* Le shell HTML ne doit jamais être servi depuis un cache : périmé, il réclame
     des fichiers que le déploiement suivant a supprimés, et l'application reste
     bloquée sur une erreur que vider le cache du service worker ne répare pas. */
  it('le shell HTML et le service worker ne sont pas mis en cache', () => {
    const noStore = (source) => (cfg.headers || []).some(r =>
      r.source === source && (r.headers || []).some(h =>
        h.key.toLowerCase() === 'cache-control' && /no-store/.test(h.value)));
    for (const s of ['/', '/index.html', '/sw.js']) expect(noStore(s)).toBe(true);
  });
});
