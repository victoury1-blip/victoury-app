// Réception d'une commande passée sur le site.
//
// Elle transite par ce relais plutôt que d'être écrite directement depuis le
// navigateur pour une seule raison : capter l'IP du visiteur, connue du
// serveur mais jamais du navigateur, et en déduire sa ville — deux colonnes
// qu'affiche le tableau des commandes de l'administration. Le reste de la
// validation (champs obligatoires, mise en forme) est le même code que
// l'ancien chemin direct, partagé avec les tests.

import { champsManquants, construireCommande, normaliserTelephone } from '../src/lib/commande.js';
import { totalPanier } from '../src/lib/pricing.js';
import { rateLimited } from './_rateLimit.js';

const SOURCES_CONNUES = new Set(['Instagram', 'Facebook', 'TikTok', 'Google', 'WhatsApp', 'Direct']);

const clientIp = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null;

/* Le prix envoyé par le navigateur (lignes.price, total) n'a jamais été fiable
   côté serveur : c'est un simple champ de localStorage, modifiable via les
   outils de développement ou en rejouant la requête réseau avec un total
   différent — sur un site en paiement à la livraison, ça revient à composer
   soi-même le montant que le livreur encaissera. Cette fonction reconstruit
   la commande à partir des SEULES données dignes de confiance : les prix et
   stocks actuels des produits en base, jamais ceux fournis par le client. */
async function recalculerLignes(url, key, lignes) {
  const slugs = [...new Set((lignes || []).map(l => l.slug).filter(Boolean))];
  if (!slugs.length) return { erreur: 'Panier vide.' };

  const r = await fetch(
    `${url}/rest/v1/shop_products?select=slug,name,price,collection_id,images:shop_product_images(url,position),sizes:shop_product_sizes(size,stock)&slug=in.(${slugs.map(s => `"${s}"`).join(',')})&status=eq.Actif`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!r.ok) return { erreur: 'Vérification du panier impossible. Réessayez.' };
  const produits = await r.json();
  const parSlug = new Map(produits.map(p => [p.slug, p]));

  const serverLignes = [];
  for (const l of lignes) {
    const p = parSlug.get(l.slug);
    // Produit introuvable ou retiré de la vente depuis que le client l'a
    // ajouté à son panier : jamais de repli sur le prix envoyé par le
    // navigateur, la commande est refusée plutôt qu'acceptée à un montant
    // inventé.
    if (!p) return { erreur: 'Un article de votre panier n\'est plus disponible. Rechargez la page.' };
    const taille = p.sizes?.find(s => s.size === (l.size || ''));
    const stock = taille?.stock ?? 0;
    const qty = Math.max(1, Math.floor(Number(l.qty) || 1));
    if (stock < qty) return { erreur: `Stock insuffisant pour "${p.name}"${l.size ? ` (${l.size})` : ''}. Ajustez la quantité.` };
    serverLignes.push({
      slug: p.slug, name: p.name, price: p.price, qty, size: l.size || '',
      color: l.color, image: p.images?.slice().sort((a, b) => a.position - b.position)[0]?.url,
      collectionId: p.collection_id,
    });
  }
  return { lignes: serverLignes };
}

/* Réglages et remises actifs, mêmes règles que celles affichées côté
   client — recalculées ici pour ne jamais dépendre du total que le
   navigateur prétend avoir obtenu avec ces mêmes règles. */
async function chargerReglagesPrix(url, key) {
  const r = await fetch(`${url}/rest/v1/shop_settings?select=key,value&key=in.(boutique,remises)`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!r.ok) return { livraison: 0, seuilGratuit: null, remises: [] };
  const rows = await r.json();
  const map = Object.fromEntries(rows.map(x => [x.key, x.value]));
  return {
    livraison: map.boutique?.livraison || 0,
    seuilGratuit: map.boutique?.seuilGratuit ?? null,
    remises: Array.isArray(map.remises) ? map.remises : [],
  };
}

async function verifierPromoServeur(url, key, code, apresQuantite) {
  if (!code) return null;
  const r = await fetch(`${url}/rest/v1/rpc/shop_check_promo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({ p_code: code, p_total: apresQuantite }),
  }).then(r => r.ok ? r.json() : null).catch(() => null);
  return r?.[0] || null;
}

/* Localisation à partir de l'IP — au mieux : une IP mobile ou un VPN donne
   souvent une ville approximative, parfois rien du tout. Une géolocalisation
   absente ne doit jamais empêcher la commande de partir.
   Deux services plutôt qu'un : ipapi.co a un quota gratuit vite atteint, et
   répond alors par une erreur silencieuse (la ville restait vide très
   souvent) — ipwho.is prend le relais quand le premier ne répond rien. */
async function interroger(url, ac) {
  const r = await fetch(url, { signal: ac.signal });
  if (!r.ok) return null;
  return r.json();
}

async function localiser(ip) {
  if (!ip || ip === '127.0.0.1' || ip.startsWith('::')) return null;
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 3500);
  try {
    const d = await interroger(`https://ipapi.co/${ip}/json/`, ac).catch(() => null);
    if (d && !d.error && d.city) return { ville: d.city, pays: d.country_name || null };

    const d2 = await interroger(`https://ipwho.is/${ip}`, ac).catch(() => null);
    if (d2?.success && d2.city) return { ville: d2.city, pays: d2.country || null };

    return null;
  } finally {
    clearTimeout(to);
  }
}

/* Filet de secours : une copie de chaque commande part vers une feuille
   Google Sheets (Apps Script déployé en Web App, réglé dans /store/reglages)
   — consultable même si l'application ou Supabase a un souci. Jamais
   bloquant : un webhook injoignable ne doit jamais faire échouer la vente. */
async function copierVersSheet(url, key, commande) {
  try {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 3000);
    const r = await fetch(`${url}/rest/v1/shop_settings?key=eq.boutique&select=value`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: ac.signal,
    });
    clearTimeout(to);
    if (!r.ok) return;
    const lignes = await r.json();
    const webhook = lignes?.[0]?.value?.sheetWebhookUrl;
    if (!webhook) return;

    const produits = (commande.products || []).map(p => `${p.name}${p.size ? ` (${p.size})` : ''} ×${p.qty}`).join(', ');
    // Sans délai propre, un Apps Script lent ou en sommeil (cas fréquent :
    // Google le met en veille après une période d'inactivité, le premier
    // appel qui le réveille peut prendre plusieurs dizaines de secondes)
    // bloquait TOUTE la réponse de la commande — le client restait sur
    // "Envoi en cours…" indéfiniment alors que la commande, elle, était déjà
    // enregistrée avec succès.
    const acWebhook = new AbortController();
    const toWebhook = setTimeout(() => acWebhook.abort(), 4000);
    try {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: acWebhook.signal,
        body: JSON.stringify({
          id: commande.id,
          date: commande.date_added,
          nom: commande.recipient.name,
          telephone: commande.recipient.phone,
          ville: commande.recipient.city,
          adresse: commande.recipient.address,
          produits,
          total: commande.price,
        }),
      });
    } finally {
      clearTimeout(toWebhook);
    }
  } catch { /* le pire cas est une ligne manquante dans la feuille, jamais une vente perdue */ }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return res.status(503).json({ error: 'Configuration serveur manquante' });

  const { form, lignes, source, code, geoGPS } = req.body || {};
  if (!form || !Array.isArray(lignes)) return res.status(400).json({ error: 'Requête invalide' });

  const manque = champsManquants(form, lignes);
  if (manque.length) return res.status(400).json({ ok: false, manque });

  const ip = clientIp(req);

  // Un abus grossier (bot, ou la faille de prix ci-dessous scriptée en boucle)
  // n'a plus aucun frein sans ceci : quelques commandes par minute suffisent
  // largement à un vrai client, jamais à un script.
  if (rateLimited(`commande:${ip || 'inconnu'}`, 8, 60_000)) {
    return res.status(200).json({ ok: false, error: 'Trop de tentatives. Merci de patienter une minute.' });
  }

  // Bloquée depuis /store/commandes : un message d'erreur plausible ("site
  // indisponible"), jamais "vous êtes bloqué" — sinon le visiteur comprend
  // qu'il est banni et change de wifi/4G pour recommencer aussitôt. Une IP
  // absente (rare, mais possible derrière certains proxys) ne doit jamais
  // bloquer une vraie commande.
  const MESSAGE_PANNE = 'Ce service est temporairement indisponible. Merci de réessayer plus tard.';
  if (ip) {
    const estBloquee = await fetch(`${url}/rest/v1/rpc/shop_ip_est_bloquee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ p_ip: ip }),
    }).then(r => r.ok ? r.json() : false).catch(() => false);
    if (estBloquee) return res.status(200).json({ ok: false, error: MESSAGE_PANNE });
  }

  // Complément de l'IP : un visiteur qui rebloque son numéro depuis un autre
  // wifi/4G (donc une autre IP) reste bloqué via son téléphone.
  const telBloque = await fetch(`${url}/rest/v1/rpc/shop_telephone_est_bloque`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({ p_tel: normaliserTelephone(form.telephone) }),
  }).then(r => r.ok ? r.json() : false).catch(() => false);
  if (telBloque) return res.status(200).json({ ok: false, error: MESSAGE_PANNE });

  const { lignes: serverLignes, erreur } = await recalculerLignes(url, key, lignes);
  if (erreur) return res.status(200).json({ ok: false, error: erreur });

  const { livraison, seuilGratuit, remises } = await chargerReglagesPrix(url, key);
  // Premier passage sans code promo pour connaître le montant après remise
  // par quantité — c'est CE montant, jamais celui envoyé par le client, que
  // la remise du code promo doit ensuite porter (même règle que côté client,
  // voir Commander.jsx).
  const avantPromo = totalPanier(serverLignes, { remises, livraison, seuilGratuit });
  const promo = await verifierPromoServeur(url, key, code, avantPromo.sousTotal - avantPromo.remiseQuantite);
  const totalVerifie = totalPanier(serverLignes, { remises, promo, livraison, seuilGratuit }).total;

  // Le GPS du navigateur (si le client l'a accepté) est bien plus fiable que
  // l'IP — les opérateurs mobiles marocains sortent souvent par des passerelles
  // enregistrées en Europe, ce qui fait dire "Marseille" ou "Londres" à toute
  // géolocalisation par IP pour un client réellement au Maroc. On ne le fait
  // JAMAIS attendre : s'il n'est pas déjà là, on retombe sur l'IP.
  const villeGPS = typeof geoGPS?.ville === 'string' ? geoGPS.ville.slice(0, 100) : null;
  const paysGPS = typeof geoGPS?.pays === 'string' ? geoGPS.pays.slice(0, 100) : null;
  const geo = villeGPS ? { ville: villeGPS, pays: paysGPS } : await localiser(ip);
  const commande = construireCommande(form, serverLignes, totalVerifie, new Date(), undefined, {
    source: SOURCES_CONNUES.has(source) ? source : 'Direct',
  });
  commande.recipient.ip = ip || undefined;
  commande.recipient.geoVille = geo?.ville || undefined;
  commande.recipient.geoPays = geo?.pays || undefined;
  commande.recipient.geoPrecise = !!villeGPS || undefined;

  const r = await fetch(`${url}/rest/v1/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(commande),
  });
  if (!r.ok) {
    const texte = await r.text().catch(() => '');
    console.error('commande:', r.status, texte.slice(0, 300));
    return res.status(502).json({ ok: false, error: "L'enregistrement a échoué. Réessayez." });
  }

  // Le stock baisse dès que la commande part, pas seulement à la livraison :
  // sinon deux clientes peuvent commander la dernière taille S en même temps
  // sans que ni l'une ni l'autre ne le voie. Un échec ici ne doit jamais faire
  // échouer la commande elle-même — le pire cas est un stock à corriger à la
  // main, pas une vente perdue.
  await Promise.all(serverLignes.map(l =>
    fetch(`${url}/rest/v1/rpc/shop_decrement_stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ p_slug: l.slug, p_size: l.size || '', p_qty: l.qty || 1 }),
    }).catch(() => {})
  ));

  // Attendu (pas laissé en arrière-plan) : une fois la réponse envoyée, Vercel
  // peut geler la fonction avant qu'un appel encore en vol n'ait eu le temps
  // d'aboutir — la copie vers la feuille ne partirait alors jamais.
  await copierVersSheet(url, key, commande);

  return res.status(200).json({ ok: true, id: commande.id });
}
