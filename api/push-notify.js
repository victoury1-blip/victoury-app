// Envoi des notifications push "Nouvelle commande" — appelé par un Database
// Webhook Supabase (Database → Webhooks) sur INSERT dans `orders`. Ne fait
// rien tant que la commande ne vient pas DU SITE (recipient.source rempli —
// voir src/hooks/useMetaCapi.js pour la même distinction) : une commande
// saisie à la main dans l'admin n'a pas besoin de se notifier elle-même.
//
// Variables d'environnement requises (Vercel → Settings → Environment
// Variables, projet DE L'ADMIN) :
//   VITE_SUPABASE_URL          (déjà présente)
//   SUPABASE_SERVICE_ROLE_KEY  (Project Settings → API → service_role, secrète)
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY  (générées une fois, jamais régénérées
//     ensuite — les abonnements existants deviendraient invalides)
//   VAPID_SUBJECT               (ex. "mailto:contact@victoury-maroc.com")
//   PUSH_NOTIFY_SECRET          (chaîne aléatoire longue, choisie par vous) —
//     à recopier dans Supabase → Database → Webhooks → cette route →
//     "HTTP Headers" → ajouter `x-webhook-secret: <la même valeur>`.
//     Tant que cette variable n'est pas définie, la route reste ouverte.

import { timingSafeEqual } from 'crypto';
import { envoyerPush } from './_push.js';

function secretValide(req) {
  const attendu = process.env.PUSH_NOTIFY_SECRET;
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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });
  if (!secretValide(req)) return res.status(401).json({ error: 'Non autorisé' });

  const commande = req.body?.record || req.body?.new || req.body;
  if (!commande?.id || !commande?.recipient?.source) {
    return res.status(200).json({ skip: true });
  }

  const nom = commande.recipient?.name || 'Client';
  const ville = commande.recipient?.city || '';
  const prix = commande.price ? ` — ${commande.price} DH` : '';
  const produits = commande.products?.length ? commande.products : (commande.product ? [commande.product] : []);
  const ligneProduit = produits[0]
    ? `📦 ${produits[0].name}${produits.length > 1 ? ` +${produits.length - 1}` : ''} (${produits[0].qty || 1}x)`
    : '';
  const message = {
    title: `🛍️ Nouvelle commande${ville ? ` (${ville})` : ''}`,
    body: [`${nom}${prix}`, ville ? `📍 ${ville}` : '', ligneProduit].filter(Boolean).join('\n'),
    tag: `commande-${commande.id}`,
    url: '/commandes/a-confirmer',
  };

  const r = await envoyerPush(message);
  if (r.erreur) return res.status(500).json({ error: r.erreur });
  res.status(200).json(r);
}
