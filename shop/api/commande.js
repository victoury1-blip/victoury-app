// Réception d'une commande passée sur le site.
//
// Elle transite par ce relais plutôt que d'être écrite directement depuis le
// navigateur pour une seule raison : capter l'IP du visiteur, connue du
// serveur mais jamais du navigateur, et en déduire sa ville — deux colonnes
// qu'affiche le tableau des commandes de l'administration. Le reste de la
// validation (champs obligatoires, mise en forme) est le même code que
// l'ancien chemin direct, partagé avec les tests.

import { champsManquants, construireCommande } from '../src/lib/commande.js';

const SOURCES_CONNUES = new Set(['Instagram', 'Facebook', 'TikTok', 'Google', 'WhatsApp', 'Direct']);

const clientIp = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null;

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
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
  } catch { /* le pire cas est une ligne manquante dans la feuille, jamais une vente perdue */ }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return res.status(503).json({ error: 'Configuration serveur manquante' });

  const { form, lignes, total, source } = req.body || {};
  if (!form || !Array.isArray(lignes)) return res.status(400).json({ error: 'Requête invalide' });

  const manque = champsManquants(form, lignes);
  if (manque.length) return res.status(400).json({ ok: false, manque });

  const ip = clientIp(req);

  // Bloquée depuis /store/commandes : on répond comme si tout s'était bien
  // passé — dire "vous êtes bloqué" ne ferait que pousser à changer de
  // wifi/4G et recommencer aussitôt. Une IP absente (rare, mais possible
  // derrière certains proxys) ne doit jamais bloquer une vraie commande.
  if (ip) {
    const estBloquee = await fetch(`${url}/rest/v1/rpc/shop_ip_est_bloquee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ p_ip: ip }),
    }).then(r => r.ok ? r.json() : false).catch(() => false);
    if (estBloquee) return res.status(200).json({ ok: true, id: 'VS-000000-000000' });
  }

  const [geo] = await Promise.all([localiser(ip)]);
  const commande = construireCommande(form, lignes, Number(total) || 0, new Date(), undefined, {
    source: SOURCES_CONNUES.has(source) ? source : 'Direct',
  });
  commande.recipient.ip = ip || undefined;
  commande.recipient.geoVille = geo?.ville || undefined;
  commande.recipient.geoPays = geo?.pays || undefined;

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
  await Promise.all(lignes.map(l =>
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
