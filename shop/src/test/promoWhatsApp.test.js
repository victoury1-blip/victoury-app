import { describe, it, expect, beforeEach } from 'vitest';
import { capturerCodeUrl, lignePromoWhatsApp, oublierCodeAuto } from '../lib/promoAuto';

describe('lignePromoWhatsApp', () => {
  beforeEach(() => oublierCodeAuto());

  it('ne dit rien sans code de pub', () => {
    expect(lignePromoWhatsApp(true)).toBe('');
  });

  it('mentionne le code reçu par le lien de pub', () => {
    capturerCodeUrl('?code=retour30');
    expect(lignePromoWhatsApp(true)).toContain('RETOUR30');
    expect(lignePromoWhatsApp(false)).toContain('code RETOUR30');
  });

  it('oublie le code après 14 jours', () => {
    capturerCodeUrl('?code=RETOUR30', 0);
    expect(lignePromoWhatsApp(true, 15 * 24 * 3600 * 1000)).toBe('');
  });
});
