import { describe, it, expect, beforeAll } from 'vitest';
import { webcrypto } from 'node:crypto';
import { telephonePourMeta, idEvenement, sha256 } from '../lib/pixel';

beforeAll(() => {
  if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;
});

/* Meta n'accepte le téléphone qu'au format international sans « + » : un
   numéro marocain envoyé avec son zéro ne correspond à personne, et le
   rapprochement échoue en silence — la conversion est reçue mais rattachée à
   personne. */
describe('téléphone pour Meta', () => {
  it('remplace le zéro initial par 212', () => {
    expect(telephonePourMeta('0612345678')).toBe('212612345678');
  });

  it('retire les séparateurs avant de convertir', () => {
    expect(telephonePourMeta('06 12-34.56(78)')).toBe('212612345678');
  });

  it('ne fabrique rien à partir de rien', () => {
    expect(telephonePourMeta('')).toBe('');
  });
});

/* Le pixel du navigateur (bloqué par les bloqueurs de pub) et le relais
   serveur envoient le MÊME achat sous le même identifiant : c'est ce qui
   permet à Meta de dédupliquer au lieu de compter la vente deux fois. */
describe('identifiant d’évènement', () => {
  it('porte le préfixe fourni', () => {
    expect(idEvenement('VS-AB12')).toMatch(/^VS-AB12-/);
  });

  it('diffère à chaque appel', () => {
    const vus = new Set(Array.from({ length: 200 }, () => idEvenement('t')));
    expect(vus.size).toBeGreaterThan(195);
  });
});

/* Les données personnelles ne partent jamais en clair vers Meta : ph/em sont
   des empreintes SHA-256, comme l'exige l'API de Conversions. */
describe('hachage', () => {
  it('produit une empreinte SHA-256 en minuscules', async () => {
    const h = await sha256('212612345678');
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });

  it('est stable pour la même valeur', async () => {
    expect(await sha256('test@mail.com')).toBe(await sha256('test@mail.com'));
  });
});
