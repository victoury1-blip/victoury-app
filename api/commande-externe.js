// Point d'entrée public pour une commande créée par un outil EXTERNE (ex. la
// landing page construite dans Google AI Studio, hébergée hors de ce projet).
// Reçoit un JSON en POST et écrit directement dans `orders` (même table que
// le reste de l'application) via la clé de service — ce qui contourne les
// policies RLS, strictement limitées aux commandes du site (préfixe VS-, voir
// shop/schema.sql) et donc inutilisables pour une source tierce.
//
// Variables d'environnement requises (Vercel → Settings → Environment
// Variables, projet DE L'ADMIN) :
//   VITE_SUPABASE_URL          (déjà présente)
//   SUPABASE_SERVICE_ROLE_KEY  (Project Settings → API → service_role, secrète)
//   COMMANDE_EXTERNE_SECRET    (chaîne aléatoire longue, choisie par vous) —
//     à mettre dans l'outil AI Studio comme en-tête `x-webhook-secret`.
//     Tant que cette variable n'est pas définie, la route reste ouverte à
//     n'importe qui connaissant son adresse — à définir avant publicité réelle.
//
// Corps attendu (noms de champs flexibles pour s'adapter à l'outil externe) :
//   {
//     "order_id": "MC-849201",        // optionnel — gardé comme référence, pas comme id interne
//     "customer_name": "...",
//     "phone": "...",
//     "city": "...",
//     "address": "...",
//     "product_name": "...",
//     "price": 299,                    // optionnel
//     "quantity": 1                    // optionnel, défaut 1
//   }

import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';

/* Préfixe réservé à cette source : ne doit jamais se confondre avec VI (saisie
   manuelle), VS- (site), ni WC- (ancienne boutique) — voir src/lib/victId.js
   et shop/src/lib/commande.js pour les autres séries de l'application. */
const PREFIXE = 'EXT-';

function nouvelId(now = new Date(), alea = Math.random) {
  const p = (n, l = 2) => String(n).padStart(l, '0');
  const date = `${p(now.getDate())}${p(now.getMonth() + 1)}${p(now.getFullYear() % 100)}`;
  const heure = `${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  const r = Math.floor(alea() * 1000);
  return `${PREFIXE}${date}-${heure}${String(r).padStart(3, '0')}`;
}

function horodatage(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function normaliserTelephone(tel) {
  let s = String(tel || '').replace(/[\s\-.()+]/g, '').replace(/^(00212|212)/, '0');
  if (/^[5-7]\d{8}$/.test(s)) s = '0' + s;
  return s;
}

function secretValide(req) {
  const attendu = process.env.COMMANDE_EXTERNE_SECRET;
  if (!attendu) return true; // pas encore configuré — voir commentaire ci-dessus
  const recu = req.headers['x-webhook-secret'];
  if (!recu || recu.length !== attendu.length) return false;
  try {
    return timingSafeEqual(Buffer.from(recu), Buffer.from(attendu));
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  // CORS : l'outil externe tourne sur un autre domaine (AI Studio), le
  // navigateur du client final envoie donc une requête cross-origin.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-webhook-secret');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });
  if (!secretValide(req)) return res.status(401).json({ error: 'Non autorisé' });

  const body = req.body || {};
  const nom = String(body.customer_name || body.nom || '').trim();
  const phone = normaliserTelephone(body.phone || body.telephone || '');
  const ville = String(body.city || body.ville || '').trim();
  const adresse = String(body.address || body.adresse || '').trim();
  const produitNom = String(body.product_name || body.produit || '').trim();
  const qty = Math.max(1, parseInt(body.quantity || body.qty, 10) || 1);
  const prix = Number(body.price || body.prix) || 0;
  const refExterne = String(body.order_id || '').trim();

  const manque = [];
  if (!nom) manque.push('customer_name');
  if (!/^0[5-7]\d{8}$/.test(phone)) manque.push('phone');
  if (!ville) manque.push('city');
  if (!adresse) manque.push('address');
  if (!produitNom) manque.push('product_name');
  if (manque.length) return res.status(400).json({ error: 'Champs manquants ou invalides', champs: manque });

  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return res.status(500).json({ error: 'Clé de service Supabase manquante' });
  const supabase = createClient(url, serviceKey);

  const now = new Date();
  const ts = horodatage(now);
  const id = nouvelId(now);
  const produit = { name: produitNom, size: '', qty };

  const commande = {
    id,
    recipient: {
      name: nom,
      phone,
      city: ville,
      address: adresse,
      delivery: null,
      source: 'landing-externe',
    },
    product: produit,
    products: [produit],
    price: prix,
    status: 'nouveau',
    note: refExterne ? `Commande externe (landing page) — réf. ${refExterne}` : 'Commande externe (landing page)',
    date_added: ts,
    date_updated: ts,
    validated: false,
    echange: false,
    report_date: null,
    note_livraison: '',
    tracking_number: null,
    is_deleted: false,
  };

  const { error } = await supabase.from('orders').insert(commande);
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ ok: true, id });
}
