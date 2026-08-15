import { describe, it, expect, vi, beforeAll } from 'vitest';
import { webcrypto } from 'node:crypto';
import { phoneForMeta, eventForStatus, eventId, buildEvent, EVENT_BY_STATUS } from '../lib/metaCapi';

beforeAll(() => {
  if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;
});

describe('numéro envoyé à Meta', () => {
  /* Meta n'accepte que le format international sans « + ». Un numéro marocain
     envoyé avec son zéro ne correspond à personne, et le rapprochement échoue
     en silence : la conversion est acceptée mais n'est attribuée à personne. */
  it('convertit un numéro marocain en format international', () => {
    expect(phoneForMeta('0612345678')).toBe('212612345678');
    expect(phoneForMeta('+212612345678')).toBe('212612345678');
    expect(phoneForMeta('612345678')).toBe('212612345678');
    expect(phoneForMeta('06 12 34 56 78')).toBe('212612345678');
  });

  it('ne fabrique rien à partir de rien', () => {
    expect(phoneForMeta('')).toBe('');
    expect(phoneForMeta(null)).toBe('');
  });
});

describe('correspondance statut → évènement', () => {
  /* « Purchase » ne doit partir QUE sur une livraison : c'est le seul moment où
     l'argent est encaissé, et c'est tout l'intérêt de l'envoi. */
  it('seule une livraison vaut un achat', () => {
    expect(eventForStatus('livre').name).toBe('Purchase');
    expect(eventForStatus('confirme').name).toBe('Lead');
    expect(eventForStatus('annule').name).toBe('OrderCancelled');
    expect(eventForStatus('nouveau')).toBeNull();
    expect(eventForStatus('att_ramassage')).toBeNull();
  });

  it('seuls les achats portent un montant', () => {
    for (const [status, spec] of Object.entries(EVENT_BY_STATUS)) {
      if (spec.withValue) expect(spec.name).toBe('Purchase');
      else expect(spec.name).not.toBe('Purchase');
      expect(typeof status).toBe('string');
    }
  });

  it('l’identifiant d’évènement est stable', () => {
    // Il sert à Meta pour ne pas compter deux fois une vente déjà signalée par
    // le pixel du site : il doit donc être le même à chaque envoi.
    const o = { id: 'VI00042' };
    expect(eventId(o, 'Purchase')).toBe('VI00042:Purchase');
    expect(eventId(o, 'Purchase')).toBe(eventId({ id: 'VI00042' }, 'Purchase'));
  });
});

describe('évènement construit', () => {
  const order = {
    id: 'VI00042', status: 'livre', price: 250,
    product: { name: 'Ensemble Sporte' },
    recipient: { name: 'Fatima Zahra', phone: '0612345678', city: 'Casablanca' },
  };

  it('n’envoie que des données hachées', async () => {
    const ev = await buildEvent(order, {});
    const hash = /^[a-f0-9]{64}$/;
    for (const vals of Object.values(ev.user_data)) {
      for (const v of vals) expect(v).toMatch(hash);
    }
    // Le numéro en clair ne doit apparaître nulle part dans l'évènement.
    expect(JSON.stringify(ev)).not.toContain('0612345678');
    expect(JSON.stringify(ev)).not.toContain('212612345678');
  });

  it('porte le montant encaissé et sa devise', async () => {
    const ev = await buildEvent(order, {});
    expect(ev.event_name).toBe('Purchase');
    expect(ev.custom_data.value).toBe(250);
    expect(ev.custom_data.currency).toBe('MAD');
  });

  it('n’invente pas d’évènement pour un statut sans issue', async () => {
    expect(await buildEvent({ ...order, status: 'nouveau' }, {})).toBeNull();
  });

  it('horodate dans le passé, jamais dans le futur', async () => {
    // Meta rejette un évènement daté en avance.
    const ev = await buildEvent(order, {});
    expect(ev.event_time).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
  });
});
