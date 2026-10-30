// Notifications Ozon Express (Webhooks) : Ozon appelle cette adresse à chaque
// changement de statut d'un colis, avec { orderId, orderStatus, situation, note }
// (orderId = code de suivi du colis chez Ozon).
//
// Le statut est enregistré dans orders.ozone_last_status — la même étiquette
// que la synchro du navigateur et la fenêtre du camion — sans toucher au
// statut de la commande dans l'application (règle décidée après les faux
// « Livré » : c'est l'équipe qui change le statut, Ozon informe seulement).
// Avantage : à jour en temps réel, application fermée, pour tous les colis.
//
// Adresse à donner à Ozon : https://app.victoury-maroc.com/api/ozon-webhook?token=<OZON_WEBHOOK_SECRET>
// Variables Vercel : OZON_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL.

import { timingSafeEqual } from 'node:crypto';

// Libellés Ozon des codes de statut — liste complète « Statut Colis en JSON »
// de leur page Webhooks. Le libellé lu en direct chez Ozon reste prioritaire.
const LIBELLES = {
  PAID: 'Payé', INVOICED: 'Facturé', NEW_PARCEL: 'Nouveau Colis', WAITING_PICKUP: 'Attente De Ramassage',
  PICKED_UP: 'Ramassé', SENT: 'Expédié', RECEIVED: 'Reçu', DISTRIBUTION: 'Mise en distribution',
  IN_PROGRESS: 'En cours', RETURNED: 'Retourné', DELIVERED: 'Livré', POSTPONED: 'Reporté',
  NOANSWER: 'Pas de réponse + SMS', OUT_OF_AREA: 'Hors-zone', CANCELED: 'Annulé', REFUSE: 'Refusé',
  EN: 'Erreur Numero', INT: 'client intéressé', PROGRAMED: 'Programmé', NOT_PAID: 'Non Payé',
  RPO: 'reporté aujourd hui', SANS_ADRE: 'sans adresse', DEPLA: 'pas réponse +déplacement',
  REMBOURSED: 'Remboursé', SENT_TO_AGENCY: "Envoyé à l'agence", RECEIVED_IN_AGENCY: 'Reçu En Agence De Livraison',
  NOANSWER_DAY_2: 'Pas de réponse J+2', NOANSWER_DAY_3: 'Pas de réponse J+3',
  DEPLA_DAY_2: 'pas réponse + déplacement J+2', DEPLA_DAY_3: 'pas réponse + déplacement J+3',
  BAM_SEIZED: 'Saisi par Barid Al-Maghrib', PRE_PICKED_UP: 'Pré ramassé', DAMAGED: 'Endommagé',
  VLMN: 'Retard Livraison 48h-72h', SCTR: 'Hors Secteur', NCVRT: 'Zone Non-couverte', DECLINED: 'Refusé',
};

const egal = (a, b) => {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
};

const chiffres9 = (t) => String(t || '').replace(/\D/g, '').slice(-9);

/** Code « RETURNED_TO_SENDER » → « Returned To Sender » si rien de mieux. */
const enForme = (code) => String(code || '').toLowerCase().split('_').filter(Boolean)
  .map(m => m[0].toUpperCase() + m.slice(1)).join(' ');

async function postOzon(url, code) {
  const body = new FormData();
  body.append('tracking-number', code);
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 6000);
  try {
    const r = await fetch(url, { method: 'POST', body, signal: ac.signal });
    return r.ok ? r.json() : null;
  } catch { return null; } finally { clearTimeout(t); }
}

/** Même lecture que src/lib/ozonStatut.js : statut + téléphone du colis. */
async function lireChezOzon(cfg, code) {
  if (!cfg?.customerId || !cfg?.apiKey) return null;
  const base = `https://api.ozonexpress.ma/customers/${cfg.customerId}/${cfg.apiKey}`;
  const [trackJson, infoJson] = await Promise.all([postOzon(`${base}/tracking`, code), postOzon(`${base}/parcel-info`, code)]);
  const track = trackJson ? (trackJson.TRACKING || trackJson) : {};
  const parcel = infoJson ? (infoJson['PARCEL-INFO'] || infoJson) : {};
  const infos = parcel.INFOS || parcel;
  const last = track.LAST_TRACKING || track['LAST-TRACKING'] || {};
  return {
    statut: last.STATUT || last.STATUS || infos['PARCEL-STATUS'] || infos.STATUS || track.STATUT || '',
    telephone: infos.PHONE || infos['RECIPIENT-PHONE'] || '',
  };
}

export default async function handler(req, res) {
  // Un GET sert seulement à vérifier que l'adresse répond.
  if (req.method === 'GET') return res.status(200).json({ ok: true });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const secret = process.env.OZON_WEBHOOK_SECRET;
  const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !url || !cle) return res.status(503).json({ error: 'Configuration serveur manquante' });
  if (!egal(req.query?.token, secret)) return res.status(401).json({ error: 'Non autorisé' });

  let b = req.body || {};
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = Object.fromEntries(new URLSearchParams(b)); } }
  const code = String(b.orderId || b.order_id || '').trim();
  const codeStatut = String(b.orderStatus || b.order_status || '').trim().toUpperCase();
  if (!/^[A-Za-z0-9_-]{3,40}$/.test(code)) return res.status(200).json({ ok: false, raison: 'code invalide' });

  const h = { apikey: cle, Authorization: `Bearer ${cle}` };
  const r = await fetch(
    `${url}/rest/v1/orders?select=id,recipient,ozone_last_status&or=(ozone_tracking.eq.${code},tracking_number.eq.${code})&is_deleted=not.is.true`,
    { headers: h },
  );
  const commandes = r.ok ? await r.json() : [];
  // Introuvable ou ambigu : on ne devine jamais (200 pour qu'Ozon n'insiste pas).
  if (commandes.length !== 1) return res.status(200).json({ ok: false, raison: commandes.length ? 'ambigu' : 'introuvable' });
  const o = commandes[0];

  // Libellé exact lu chez Ozon (comme la fenêtre du camion), avec contrôle du
  // téléphone : un code qui désigne le colis de quelqu'un d'autre est ignoré.
  const cfgRes = await fetch(`${url}/rest/v1/settings?select=value&key=eq.auzone_config&limit=1`, { headers: h });
  const cfg = cfgRes.ok ? (await cfgRes.json())?.[0]?.value : null;
  const ozon = await lireChezOzon(cfg, code);
  if (ozon?.telephone && chiffres9(ozon.telephone) !== chiffres9(o.recipient?.phone)) {
    return res.status(200).json({ ok: false, raison: 'autre client' });
  }
  const statut = ozon?.statut || LIBELLES[codeStatut] || enForme(codeStatut);
  if (!statut || statut === o.ozone_last_status) return res.status(200).json({ ok: true, inchange: true });

  const maj = await fetch(`${url}/rest/v1/orders?id=eq.${encodeURIComponent(o.id)}`, {
    method: 'PATCH',
    headers: { ...h, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ ozone_last_status: statut }),
  });
  return res.status(200).json({ ok: maj.ok, statut });
}
