import { describe, it, expect, beforeEach } from 'vitest';
import { detecterSource, memoriserSource, sourceVisite } from '../lib/source';

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

  it('comprend les valeurs Meta {{site_source_name}}', () => {
    expect(detecterSource('?utm_source=ig', '')).toBe('Instagram');
    expect(detecterSource('?utm_source=fb', '')).toBe('Facebook');
  });

  it('reconnaît les identifiants de clic des régies', () => {
    expect(detecterSource('?fbclid=abc', '')).toBe('Facebook');
    expect(detecterSource('?fbclid=abc', '', 'Mozilla Instagram 300.0')).toBe('Instagram');
    expect(detecterSource('?ttclid=abc', '')).toBe('TikTok');
    expect(detecterSource('?gclid=abc', '')).toBe('Google');
  });

  it('reconnaît le navigateur intégré des applications', () => {
    expect(detecterSource('', '', 'Mozilla/5.0 [FBAN/FB4A;FBAV/400.0]')).toBe('Facebook');
    expect(detecterSource('', '', 'Mozilla/5.0 Instagram 300.0.0')).toBe('Instagram');
    expect(detecterSource('', '', 'Mozilla/5.0 musical_ly_2023')).toBe('TikTok');
  });
});

describe('source gardée depuis l’arrivée', () => {
  beforeEach(() => localStorage.clear());

  it('garde la source de la page d’arrivée jusqu’à la commande', () => {
    memoriserSource('?fbclid=x', '', '', 1000);
    expect(sourceVisite('', 'https://victoury-maroc.com/produit/a', '', 2000)).toBe('Facebook');
  });

  it('une visite directe n’efface pas la source gardée', () => {
    memoriserSource('?utm_source=tiktok', '', '', 1000);
    memoriserSource('', '', '', 1500);
    expect(sourceVisite('', '', '', 2000)).toBe('TikTok');
  });

  it('expire après 30 jours', () => {
    memoriserSource('?utm_source=ig', '', '', 0);
    expect(sourceVisite('', '', '', 31 * 24 * 3600 * 1000)).toBe('Direct');
  });
});
