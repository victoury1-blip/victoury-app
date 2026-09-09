// Relance automatique des paniers abandonnés, par WhatsApp — déclenchée
// périodiquement par un cron Vercel (voir vercel.json), jamais appelée par
// le navigateur.
//
// Nécessite un modèle de message WhatsApp déjà APPROUVÉ par Meta (Business
// Manager > WhatsApp Manager > Modèles de message) : l'API Cloud de Meta
// n'autorise un message envoyé À L'INITIATIVE de l'entreprise (hors des 24h
// suivant un message du client) que sous cette forme, jamais un texte libre.
// Le nom exact du modèle se règle dans /store/reglages (relanceWhatsapp).

import { numeroWhatsApp } from '../src/lib/commande.js';

async function chargerReglagesRelance(url, key) {
  const r = await fetch(`${url}/rest/v1/shop_settings?select=value&key=eq.boutique`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!r.ok) return null;
  const [row] = await r.json();
  return row?.value?.relanceWhatsapp || null;
}

/** Numéros déjà convertis en vraie commande : jamais relancer une cliente
    qui a de toute façon fini par commander entre-temps. Même règle que
    src/lib/paniersAbandonnes.js côté admin — les 9 derniers chiffres
    seulement, le panier garde le numéro tel que tapé, la commande le
    normalise. */
const cleTel = (s) => (s || '').replace(/\D/g, '').slice(-9);

async function telsConvertis(url, key) {
  const r = await fetch(`${url}/rest/v1/orders?select=recipient&id=like.VS-*`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!r.ok) return new Set();
  const rows = await r.json();
  return new Set(rows.map(o => cleTel(o.recipient?.phone)).filter(Boolean));
}

async function envoyerModele(waToken, wapId, to, templateNom, templateLangue, prenom) {
  const r = await fetch(`https://graph.facebook.com/v20.0/${wapId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${waToken}` },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateNom,
        language: { code: templateLangue || 'fr' },
        // Un seul paramètre texte dans le corps du modèle : le prénom de la
        // cliente. Le modèle réel (créé dans WhatsApp Manager) doit donc
        // avoir exactement une variable {{1}} dans son corps — à adapter
        // ici si le modèle approuvé en a d'autres.
        components: [{ type: 'body', parameters: [{ type: 'text', text: prenom || 'là' }] }],
      },
    }),
  });
  return r.ok;
}

export default async function handler(req, res) {
  // Vercel envoie automatiquement ce header pour un cron déclaré dans
  // vercel.json, signé avec CRON_SECRET — un appel sans ce secret exact
  // (donc pas déclenché par Vercel lui-même) est refusé.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ ok: false, error: 'Non autorisé' });
  }

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const waToken = process.env.WHATSAPP_TOKEN;
  const wapId = process.env.WHATSAPP_PHONE_ID;
  if (!url || !key) return res.status(500).json({ ok: false, error: 'Configuration Supabase manquante.' });

  const reglages = await chargerReglagesRelance(url, key);
  if (!reglages?.active) return res.status(200).json({ ok: true, envoyes: 0, note: 'Relance désactivée (/store/reglages).' });
  if (!reglages.templateNom) return res.status(200).json({ ok: true, envoyes: 0, note: 'Aucun modèle WhatsApp réglé.' });
  if (!waToken || !wapId) return res.status(200).json({ ok: true, envoyes: 0, note: 'WHATSAPP_TOKEN / WHATSAPP_PHONE_ID manquants côté serveur.' });

  const delaiMs = Math.max(15, reglages.delaiMinutes || 60) * 60_000;
  const seuil = new Date(Date.now() - delaiMs).toISOString();
  // Fenêtre haute (24h) : au-delà, le message serait de toute façon hors
  // sujet — une relance sur un panier vieux d'une semaine ne convertit
  // jamais et ressemble à du spam.
  const seuilHaut = new Date(Date.now() - 24 * 60 * 60_000).toISOString();

  const r = await fetch(
    `${url}/rest/v1/shop_paniers_abandonnes?select=id,nom,telephone,created_at&relance_envoyee=eq.false&created_at=lte.${seuil}&created_at=gte.${seuilHaut}&order=created_at.asc&limit=50`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!r.ok) return res.status(200).json({ ok: false, error: 'Lecture des paniers impossible.' });
  const paniers = await r.json();
  if (!paniers.length) return res.status(200).json({ ok: true, envoyes: 0 });

  const convertis = await telsConvertis(url, key);
  let envoyes = 0;

  for (const p of paniers) {
    // Toujours marquer comme traité, même en cas d'échec d'envoi — sinon un
    // numéro WhatsApp invalide serait retenté à chaque passage du cron,
    // indéfiniment.
    const marquer = () => fetch(`${url}/rest/v1/shop_paniers_abandonnes?id=eq.${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=minimal' },
      body: JSON.stringify({ relance_envoyee: true, relance_envoyee_at: new Date().toISOString() }),
    }).catch(() => {});

    if (convertis.has(cleTel(p.telephone))) { await marquer(); continue; }
    const numero = numeroWhatsApp(p.telephone);
    if (!numero) { await marquer(); continue; }

    const prenom = (p.nom || '').trim().split(/\s+/)[0] || undefined;
    const envoye = await envoyerModele(waToken, wapId, numero, reglages.templateNom, reglages.templateLangue, prenom).catch(() => false);
    if (envoye) envoyes += 1;
    await marquer();
  }

  return res.status(200).json({ ok: true, envoyes, total: paniers.length });
}
