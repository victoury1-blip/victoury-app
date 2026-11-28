// Envoi des notifications push "Nouvelle commande" — appelé par un Database
// Webhook Supabase (Database → Webhooks) sur INSERT dans `orders`. Ne fait
// rien tant que la commande n'est pas une commande DU SITE (id "VS-...") :
// les commandes saisies dans le CRM ne doivent pas déclencher ce push-là.
//
// Cette route était appelable par N'IMPORTE QUI, sans la moindre
// vérification : il suffisait de connaître l'URL et de POSTer un JSON
// {"record":{"id":"VS-x", "recipient":{...}, ...}} fabriqué à la main pour
// déclencher un vrai push, avec un texte entièrement choisi par l'appelant,
// vers TOUS les abonnés (spam/hameçonnage "Nouvelle commande — cliquez
// ici…", ou simplement épuiser le quota d'envoi). Un secret partagé, connu
// uniquement du webhook Supabase et de ce serveur, ferme cette porte.
//
// Variables d'environnement requises (Vercel → Settings → Environment
// Variables, projet DU SITE — pas celui du CRM) :
//   VITE_SUPABASE_URL          (déjà présente)
//   SUPABASE_SERVICE_ROLE_KEY  (Project Settings → API → service_role, secrète)
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY  (générées une fois, jamais régénérées
//     ensuite — les abonnements existants deviendraient invalides)
//   VAPID_SUBJECT               (ex. "mailto:contact@victoury-maroc.com")
//   PUSH_NOTIFY_SECRET          (chaîne aléatoire longue, choisie par vous) —
//     à recopier dans Supabase → Database → Webhooks → cette route →
//     "HTTP Headers" → ajouter `x-webhook-secret: <la même valeur>`.
//     Tant que cette variable n'est pas définie, la route reste ouverte
//     (pour ne pas casser l'envoi existant avant que le webhook soit
//     reconfiguré) — définissez-la dès que possible.

import { timingSafeEqual } from 'crypto';
import { envoyerPush, payloadCommande, configManquante } from './_pushCommande.js';
import { getUser } from './_auth.js';

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

  // Bouton « Envoyer une notification de test » (/store/reglages) : réservé
  // à un membre connecté de l'administration, et ne vise que SON appareil.
  if (req.body?.test) {
    if (!(await getUser(req))) return res.status(401).json({ error: 'Non autorisé' });
    const manque = configManquante();
    if (manque.length) return res.status(200).json({ ok: false, manque });
    const r = await envoyerPush({
      title: '🔔 Test Victoury Shop',
      body: 'Les notifications de commande arrivent bien sur ce téléphone ✅',
      tag: `test-${Date.now()}`,
      url: '/store/commandes',
    }, { endpoint: typeof req.body.endpoint === 'string' ? req.body.endpoint : undefined });
    return res.status(200).json({ ok: r.envoyes > 0, ...r });
  }

  if (!secretValide(req)) return res.status(401).json({ error: 'Non autorisé' });

  const commande = req.body?.record || req.body?.new || req.body;
  if (!commande?.id || !String(commande.id).startsWith('VS-')) {
    return res.status(200).json({ skip: true });
  }
  const r = await envoyerPush(payloadCommande(commande));
  if (r.manque.length) return res.status(500).json({ error: `Push non configuré : ${r.manque.join(', ')}` });
  res.status(200).json({ envoyes: r.envoyes, perimes: r.perimes });
}
