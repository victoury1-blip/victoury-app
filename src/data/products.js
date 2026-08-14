import { cloudSet, cloudGet } from '../lib/cloudSettings';
import { isAffiliateSource, platformOf, platformOfSource } from '../lib/affiliatePlatforms';

/* Référence attendue d'un produit d'affiliation.
 * Les identifiants sont numérotés séparément par chaque site : le produit 489 de
 * Bouait portait la référence « CHIC-489 », celle du 489 de Chic — donc le même
 * produit dans le Stock, avec le prix et le stock de l'autre. Les produits déjà
 * importés sous l'ancien préfixe sont corrigés à la lecture. */
function fixAffiliateRef(p) {
  if (!isAffiliateSource(p?.source) || !p?.chicId) return p;
  const want = `${platformOf(platformOfSource(p.source)).refPrefix}-${p.chicId}`;
  return p.ref === want && p.id === want ? p : { ...p, ref: want, id: want };
}

const STORAGE_KEY = 'victoury_products';

const INITIAL_PRODUCTS = [
  {
    id: 1,
    ref: 'ENS-SPORT-001',
    name: 'ENSEMBLE SPORTE REFF 1',
    image: null,
    statut: 'Active',
    boutique: 'Manuel',
    shopifyId: '',
    prix: 350,
    compareAt: 450,
    etiquette: '',
    variations: [
      { taille: 'S',   stock: 10, prix: 350, compareAt: 450, ajust: 0 },
      { taille: 'M',   stock: 15, prix: 350, compareAt: 450, ajust: 0 },
      { taille: 'L',   stock: 12, prix: 350, compareAt: 450, ajust: 0 },
      { taille: 'XL',  stock: 8,  prix: 350, compareAt: 450, ajust: 0 },
      { taille: 'XXL', stock: 5,  prix: 350, compareAt: 450, ajust: 0 },
      { taille: '3XL', stock: 3,  prix: 350, compareAt: 450, ajust: 0 },
      { taille: '4XL', stock: 2,  prix: 350, compareAt: 450, ajust: 0 },
      { taille: '5XL', stock: 1,  prix: 350, compareAt: 450, ajust: 0 },
    ],
  },
];

export function loadProducts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.map(p => {
        if (!p.variations || p.variations.length === 0) {
          p.variations = [
            { taille: 'S', stock: 0, prix: p.prix || p.salePrice || 0, compareAt: 0, ajust: 0 },
            { taille: 'M', stock: 0, prix: p.prix || p.salePrice || 0, compareAt: 0, ajust: 0 },
            { taille: 'L', stock: 0, prix: p.prix || p.salePrice || 0, compareAt: 0, ajust: 0 },
            { taille: 'XL', stock: 0, prix: p.prix || p.salePrice || 0, compareAt: 0, ajust: 0 },
          ];
        }
        if (!p.statut) p.statut = 'Active';
        // Amorçage UNE SEULE FOIS : un article chic réellement épuisé doit rester
        // à 0 (sinon on vend de la marchandise qui n'existe pas).
        if (isAffiliateSource(p.source) && !p.stockSeeded && p.variations.every(v => !v.stock)) {
          p.variations = p.variations.map(v => ({ ...v, stock: 10 }));
          p.stockSeeded = true;
        }
        return fixAffiliateRef(p);
      });
    }
  } catch {}
  return INITIAL_PRODUCTS;
}

export function saveProducts(products) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  cloudSet(STORAGE_KEY, products);
}

export async function loadProductsRemote() {
  const remote = await cloudGet(STORAGE_KEY);
  if (Array.isArray(remote) && remote.length > 0) {
    return remote.map(p => {
      if (!p.variations || p.variations.length === 0) {
        p.variations = [
          { taille: 'S', stock: 0, prix: p.prix || 0, compareAt: 0, ajust: 0 },
          { taille: 'M', stock: 0, prix: p.prix || 0, compareAt: 0, ajust: 0 },
          { taille: 'L', stock: 0, prix: p.prix || 0, compareAt: 0, ajust: 0 },
          { taille: 'XL', stock: 0, prix: p.prix || 0, compareAt: 0, ajust: 0 },
        ];
      }
      if (!p.statut) p.statut = 'Active';
      // NB: on ne « recharge » plus artificiellement le stock des produits
      // chic-affiliate à 10 : un article réellement épuisé doit rester à 0,
      // sinon on accepte des commandes pour de la marchandise inexistante.
      if (isAffiliateSource(p.source) && !p.stockSeeded && p.variations.every(v => !v.stock)) {
        p.variations = p.variations.map(v => ({ ...v, stock: 10 }));
        p.stockSeeded = true;
      }
      return fixAffiliateRef(p);
    });
  }
  return null;
}

export function getTotalStock(product) {
  if (!product.variations) return 0;
  return product.variations.reduce((s, v) => s + (v.stock || 0), 0);
}

export const SIZE_OPTIONS = ['S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'];
export const NUMERIC_SIZES = ['36','37','38','39','40','41','42','43','44','45','46','47'];
