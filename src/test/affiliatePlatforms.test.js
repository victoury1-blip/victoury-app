import { describe, it, expect } from 'vitest';
import {
  AFFILIATE_PLATFORMS, AFFILIATE_LIST, platformOf, st, isAffiliateStatus,
  isAffiliateSource, platformOfSource, platKey,
} from '../lib/affiliatePlatforms';

describe('plateformes d’affiliation', () => {
  it('Chic reste la plateforme par défaut', () => {
    // Tout le code écrit avant qu'il y en ait plusieurs appelle sans argument.
    expect(platformOf().key).toBe('chic');
    expect(platformOf('inconnue').key).toBe('chic');
    expect(st(undefined, 'nouveau')).toBe('chic_nouveau');
  });

  it('chaque plateforme a ses propres statuts', () => {
    expect(st('chic', 'livre')).toBe('chic_livre');
    expect(st('bouait', 'livre')).toBe('bouait_livre');
    // Le point capital : deux plateformes ne partagent jamais un statut, sinon
    // leurs commandes se mélangeraient dans les mêmes onglets.
    const all = AFFILIATE_LIST.flatMap(p => ['nouveau', 'envoye', 'livre', 'facture'].map(n => st(p.key, n)));
    expect(new Set(all).size).toBe(all.length);
  });

  it('reconnaît un statut d’affiliation quelle que soit la plateforme', () => {
    expect(isAffiliateStatus('bouait_livre', 'livre')).toBe(true);
    expect(isAffiliateStatus('chic_facture', 'livre', 'facture')).toBe(true);
    expect(isAffiliateStatus('livre', 'livre')).toBe(false);
    expect(isAffiliateStatus('nouveau', 'nouveau')).toBe(false);
  });

  it('retrouve la plateforme d’un produit par sa source', () => {
    expect(platformOfSource('bouait-affiliate')).toBe('bouait');
    expect(platformOfSource('chic-affiliate')).toBe('chic');
    expect(isAffiliateSource('bouait-affiliate')).toBe(true);
    expect(isAffiliateSource('woocommerce')).toBe(false);
    // Source inconnue → Chic, comme le reste des valeurs par défaut.
    expect(platformOfSource('inconnue')).toBe('chic');
  });

  it('les hôtes et les clés de configuration sont distincts', () => {
    const hosts = AFFILIATE_LIST.map(p => p.host);
    const configs = AFFILIATE_LIST.map(p => p.configKey);
    expect(new Set(hosts).size).toBe(hosts.length);
    expect(new Set(configs).size).toBe(configs.length);
  });

  /* Les clés locales de Chic ne doivent PAS changer de nom : les renommer
     effacerait les frais de ville et les masquages déjà enregistrés. */
  it('Chic garde ses clés locales historiques', () => {
    expect(platKey('chic', 'city_frais')).toBe('chic_city_frais');
    expect(platKey(undefined, 'hidden_ids')).toBe('chic_hidden_ids');
    expect(platKey('bouait', 'city_frais')).toBe('bouait_city_frais');
  });
});

/* Le domaine avait été deviné (« bouaitaffiliate.com ») au lieu d'être lu :
   il n'existait pas, et toutes les requêtes échouaient. */
describe('domaines des plateformes', () => {
  it('les hôtes sont ceux des sites réels', () => {
    expect(AFFILIATE_PLATFORMS.chic.host).toBe('www.chic-affiliate.com');
    expect(AFFILIATE_PLATFORMS.bouait.host).toBe('bouaitafaffiliate.com');
  });

  it('origine et hôtes concordent', () => {
    for (const p of AFFILIATE_LIST) {
      expect(p.origin).toBe(`https://${p.host}`);
      expect(p.hosts).toContain(p.host);
      expect(p.origin.startsWith('https://')).toBe(true);
    }
  });
});
