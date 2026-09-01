import { describe, it, expect } from 'vitest';
import { nouvelId, horodatage, normaliserTelephone, telephoneValide, champsManquants, construireCommande } from '../lib/commande';

const client = { nom: 'Fatima Zahra', telephone: '0612345678', ville: 'Casablanca', adresse: 'Hay Mohammadi' };
const panier = [{ name: 'Ensemble Sporte Noir', size: 'L', qty: 2, price: 220 }];

/* Le numéro part chez le livreur : il doit avoir une seule forme, quelle que
   soit celle qu'a choisie le client. */
describe('téléphone', () => {
  it('ramène toutes les écritures à la forme locale', () => {
    for (const t of ['0612345678', '+212612345678', '212612345678', '06 12 34 56 78', '(0612) 345-678'])
      expect(normaliserTelephone(t)).toBe('0612345678');
  });

  it('refuse ce qui n’est pas un mobile marocain', () => {
    expect(telephoneValide('0612345678')).toBe(true);
    expect(telephoneValide('061234567')).toBe(false);   // trop court
    expect(telephoneValide('0812345678')).toBe(false);  // préfixe inexistant
    expect(telephoneValide('')).toBe(false);
  });
});

describe('champs obligatoires', () => {
  it('laisse passer une commande complète', () => {
    expect(champsManquants(client, panier)).toEqual([]);
  });

  it('nomme précisément ce qui manque', () => {
    expect(champsManquants({ ...client, ville: '' }, panier)).toEqual(['ville']);
    expect(champsManquants({ ...client, telephone: '123' }, panier)).toEqual(['telephone']);
    expect(champsManquants(client, [])).toEqual(['panier']);
  });

  it('l’e-mail reste facultatif', () => {
    expect(champsManquants({ ...client, email: '' }, panier)).toEqual([]);
  });
});

/* La commande entre directement dans la table de l'application : sa forme doit
   être exactement celle qu'attendent les factures, l'historique et le profit. */
describe('commande écrite en base', () => {
  const c = construireCommande(client, panier, 405, new Date(2026, 8, 1, 14, 5, 9), 'VS-TEST01');

  it('porte le préfixe réservé au site', () => {
    // Les règles de la base n'acceptent d'un visiteur que cette forme.
    expect(c.id.startsWith('VS-')).toBe(true);
    expect(nouvelId().startsWith('VS-')).toBe(true);
  });

  it('arrive à confirmer, jamais validée ni livrée', () => {
    expect(c.status).toBe('nouveau');
    expect(c.validated).toBe(false);
    expect(c.is_deleted).toBe(false);
  });

  it('horodate au format lu partout ailleurs', () => {
    expect(c.date_added).toBe('01/09/2026 14:05:09');
    expect(horodatage(new Date(2026, 0, 5, 9, 3, 4))).toBe('05/01/2026 09:03:04');
  });

  it('garde les articles, tailles et quantités', () => {
    expect(c.products).toEqual([{ name: 'Ensemble Sporte Noir', size: 'L', qty: 2 }]);
  });

  it('renseigne aussi le premier article, que l’application lit seul', () => {
    // Sans lui, la commande s'afficherait sans produit dans les listes.
    expect(c.product).toEqual(c.products[0]);
  });

  it('normalise le téléphone du destinataire', () => {
    expect(construireCommande({ ...client, telephone: '+212612345678' }, panier, 405).recipient.phone)
      .toBe('0612345678');
  });

  it('n’invente pas d’e-mail quand il n’y en a pas', () => {
    expect(c.recipient.email).toBeUndefined();
  });

  it('donne un identifiant différent à chaque commande', () => {
    const vus = new Set(Array.from({ length: 500 }, () => nouvelId()));
    expect(vus.size).toBeGreaterThan(490);
  });
});
