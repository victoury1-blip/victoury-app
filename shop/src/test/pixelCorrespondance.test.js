// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { memoriserFbclid, cookiesFbPourMeta, clientConnuPourPixel, idClientMeta, sha256 } from '../lib/pixel';

describe('pixel : correspondance', () => {
  beforeEach(() => { localStorage.clear(); window.history.replaceState({}, '', '/'); });

  it('garde le clic publicitaire après changement de page', () => {
    window.history.replaceState({}, '', '/?fbclid=AbC123');
    memoriserFbclid();
    window.history.replaceState({}, '', '/commander');
    expect(cookiesFbPourMeta().fbc).toMatch(/^fb\.1\.\d+\.AbC123$/);
  });

  it('reconnaît une cliente déjà venue', () => {
    localStorage.setItem('victoury_client_info', JSON.stringify({ nom: 'Fatima Zahra Alaoui', telephone: '0612345678', ville: 'Casa Blanca' }));
    expect(clientConnuPourPixel()).toEqual({ ph: '212612345678', fn: 'fatima', ln: 'zahra alaoui', ct: 'casablanca', country: 'ma' });
  });

  it('même ID externe que le serveur', async () => {
    expect(await idClientMeta('0612345678')).toBe(await sha256('victoury:212612345678'));
  });
});
