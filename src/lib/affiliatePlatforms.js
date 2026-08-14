/* Plateformes d'affiliation — source unique de vérité.
 *
 * Chic Affiliate et Bouait Affiliate tournent sur le MÊME logiciel : mêmes
 * chemins (`/affiliate/products`, `/affiliate/orders/dataTables`…), même
 * structure de pages, même session Laravel. Dupliquer les 2 700 lignes de
 * l'intégration aurait condamné les deux copies à diverger à la première
 * correction ; tout est donc paramétré par la plateforme, et en ajouter une
 * troisième ne demandera qu'une entrée ici.
 *
 * Chaque plateforme possède ses propres statuts et sa propre source produit,
 * pour que ses commandes ne se mélangent jamais à celles d'une autre.
 */
export const AFFILIATE_PLATFORMS = {
  chic: {
    key: 'chic',
    label: 'Chic Affiliate',
    host: 'www.chic-affiliate.com',
    origin: 'https://www.chic-affiliate.com',
    /* Hôtes acceptés pour les images et l'API (le site sert ses fichiers
       tantôt avec `www.`, tantôt sans). */
    hosts: ['www.chic-affiliate.com', 'chic-affiliate.com', 'api.chic-affiliate.com'],
    configKey: 'chic_config',
    source: 'chic-affiliate',
    statusPrefix: 'chic',
    path: '/chic-affiliate',
  },
  bouait: {
    key: 'bouait',
    label: 'Bouait Affiliate',
    host: 'bouaitaffiliate.com',
    origin: 'https://bouaitaffiliate.com',
    hosts: ['bouaitaffiliate.com', 'www.bouaitaffiliate.com', 'api.bouaitaffiliate.com'],
    configKey: 'bouait_config',
    source: 'bouait-affiliate',
    statusPrefix: 'bouait',
    path: '/bouait-affiliate',
  },
};

export const AFFILIATE_LIST = Object.values(AFFILIATE_PLATFORMS);

/** Plateforme par sa clé. Repli sur Chic : c'est la valeur par défaut de tous
 *  les appels existants, écrits avant qu'il y en ait plusieurs. */
export const platformOf = (key) => AFFILIATE_PLATFORMS[key] || AFFILIATE_PLATFORMS.chic;

/** Statut propre à une plateforme : st('bouait', 'nouveau') → 'bouait_nouveau'. */
export const st = (plat, name) => `${platformOf(plat).statusPrefix}_${name}`;

/** Le statut correspond-il à ce nom, quelle que soit la plateforme ?
 *  (`isAffiliateStatus('bouait_livre', 'livre')` → vrai) */
export const isAffiliateStatus = (status, ...names) =>
  AFFILIATE_LIST.some(p => names.some(n => status === `${p.statusPrefix}_${n}`));

export const AFFILIATE_SOURCES = AFFILIATE_LIST.map(p => p.source);

/** Le produit vient-il d'une plateforme d'affiliation ? */
export const isAffiliateSource = (source) => AFFILIATE_SOURCES.includes(source);

/** Clé de la plateforme d'où vient un produit. */
export const platformOfSource = (source) =>
  AFFILIATE_LIST.find(p => p.source === source)?.key || 'chic';

/** Clé de stockage local propre à la plateforme.
 *  Chic garde ses clés historiques telles quelles : les renommer aurait effacé
 *  les frais de ville et les commandes masquées déjà enregistrés. */
export const platKey = (plat, base) =>
  plat === 'chic' || !plat ? `chic_${base}` : `${platformOf(plat).statusPrefix}_${base}`;
