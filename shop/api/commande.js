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
   absente ne doit jamais empêcher la commande de partir. */
async function localiser(ip) {
  if (!ip || ip === '127.0.0.1' || ip.startsWith('::')) return null;
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 2500);
  try {
    const r = await fetch(`https://ipapi.co/${ip}/json/`, { signal: ac.signal });
    if (!r.ok) return null;
    const d = await r.json();
    if (d?.error) return null;
    return { ville: d.city || null, pays: d.country_name || null };
  } catch {
    return null;
  } finally {
    clearTimeout(to);
  }
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
  return res.status(200).json({ ok: true, id: commande.id });
}
