import { describe, it, expect } from 'vitest';
import { detecterSource } from '../lib/source';

/* L'utm_source posé volontairement par la campagne est le signal le plus
   fiable ; le référent du navigateur ne vient qu'en second, et Instagram /
   Facebook le masquent parfois selon les réglages du téléphone. */
describe('source d’une commande', () => {
  it('lit utm_source en priorité', () => {
    expect(detecterSource('?utm_source=instagram', 'https://facebook.com/')).toBe('Instagram');
  });

  it('retombe sur le référent sans utm_source', () => {
    expect(detecterSource('', 'https://www.instagram.com/')).toBe('Instagram');
    expect(detecterSource('', 'https://l.facebook.com/l.php')).toBe('Facebook');
  });

  it('reconnaît les sources courantes', () => {
    expect(detecterSource('', 'https://www.google.com/')).toBe('Google');
    expect(detecterSource('', 'https://www.tiktok.com/@x')).toBe('TikTok');
    expect(detecterSource('', 'https://wa.me/212600000000')).toBe('WhatsApp');
  });

  it('retombe sur Direct sans aucun indice', () => {
    expect(detecterSource('', '')).toBe('Direct');
  });

  it('capitalise une source inconnue plutôt que de la rejeter', () => {
    expect(detecterSource('?utm_source=snapchat', '')).toBe('Snapchat');
  });
});
