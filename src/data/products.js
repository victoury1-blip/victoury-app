import { cloudSet, cloudGet } from '../lib/cloudSettings';

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
    if (raw) return JSON.parse(raw);
  } catch {}
  return INITIAL_PRODUCTS;
}

export function saveProducts(products) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  cloudSet(STORAGE_KEY, products);
}

export async function loadProductsRemote() {
  const remote = await cloudGet(STORAGE_KEY);
  if (Array.isArray(remote) && remote.length > 0) return remote;
  return null;
}

export function getTotalStock(product) {
  return product.variations.reduce((s, v) => s + (v.stock || 0), 0);
}

export const SIZE_OPTIONS = ['S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'];
export const NUMERIC_SIZES = ['36','37','38','39','40','41','42','43','44','45','46','47'];
