import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { nextRecoveryStep } from '../lib/bundleRecovery';

/* Réparation automatique d'un bundle incohérent après un déploiement.
 *
 * Vider les caches ne suffit pas toujours : le service worker se réinstalle
 * dans la foulée et ressert la version cassée. La réparation s'arrêtait
 * pourtant là et rendait la main à l'utilisateur, avec un bouton qui refaisait
 * exactement la tentative qui venait d'échouer — l'écran revenait sans fin.
 */
describe('paliers de réparation', () => {
  it('commence par vider les caches', () => {
    expect(nextRecoveryStep(0, 60000)).toBe('caches');
  });

  it('si cela n’a pas suffi, désinstalle le service worker', () => {
    expect(nextRecoveryStep(1, 60000)).toBe('hard');
  });

  it('rend la main une fois les deux paliers épuisés', () => {
    // Sinon la page se rechargerait indéfiniment, sans jamais rien montrer.
    expect(nextRecoveryStep(2, 60000)).toBeNull();
    expect(nextRecoveryStep(5, 60000)).toBeNull();
  });

  it('ne compte pas deux échecs rapprochés comme deux chances', () => {
    // Le même chargement peut lever plusieurs erreurs : c'est une seule tentative.
    expect(nextRecoveryStep(0, 200)).toBeNull();
  });
});

/* Le CDN placé devant l'application ne doit jamais garder la page d'entrée :
   servie depuis son cache, elle réclame des fichiers d'une version disparue et
   fabrique précisément le mélange que la réparation doit ensuite défaire. */
describe('en-têtes de cache de la page d’entrée', () => {
  const cfg = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const entryPoints = ['/', '/index.html', '/sw.js', '/version.txt'];

  for (const src of entryPoints) {
    it(`${src} n’est mis en cache ni par le navigateur ni par le CDN`, () => {
      const rule = cfg.headers.find(h => h.source === src);
      expect(rule, `aucune règle pour ${src}`).toBeTruthy();
      const byKey = Object.fromEntries(rule.headers.map(h => [h.key, h.value]));
      expect(byKey['Cache-Control']).toMatch(/no-store/);
      expect(byKey['Cloudflare-CDN-Cache-Control']).toBe('no-store');
      expect(byKey['CDN-Cache-Control']).toBe('no-store');
    });
  }
});
