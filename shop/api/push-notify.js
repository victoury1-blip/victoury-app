// Envoi des notifications push "Nouvelle commande" — appelé par un Database
// Webhook Supabase (Database → Webhooks) sur INSERT dans `orders`. Ne fait
// rien tant que la commande n'est pas une commande DU SITE (id "VS-...") :
// les commandes saisies dans le CRM ne doivent pas déclencher ce push-là.
//
// Variables d'environnement requises (Vercel → Settings → Environment
// Variables, projet DU SITE — pas celui du CRM) :
//   VITE_SUPABASE_URL          (déjà présente)
//   SUPABASE_SERVICE_ROLE_KEY  (Project Settings → API → service_role, secrète)
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY  (générées une fois, jamais régénérées
//     ensuite — les abonnements existants deviendraient invalides)
//   VAPID_SUBJECT               (ex. "mailto:contact@victoury-maroc.com")

import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const commande = req.body?.record || req.body?.new || req.body;
  if (!commande?.id || !String(commande.id).startsWith('VS-')) {
    return res.status(200).json({ skip: true });
  }

  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!url || !serviceKey || !vapidPublic || !vapidPrivate) {
    return res.status(500).json({ error: 'Push non configuré (variables VAPID / clé de service manquantes)' });
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:contact@victoury-maroc.com', vapidPublic, vapidPrivate);

  const supabase = createClient(url, serviceKey);
  const { data: abonnements, error } = await supabase.from('shop_push_subscriptions').select('endpoint, keys');
  if (error) return res.status(500).json({ error: error.message });
  if (!abonnements?.length) return res.status(200).json({ envoyes: 0 });

  const nom = commande.recipient?.name || 'Client';
  const ville = commande.recipient?.city || '';
  const prix = commande.price ? ` — ${commande.price} DH` : '';
  const produits = commande.products?.length ? commande.products : (commande.product ? [commande.product] : []);
  const ligneProduit = produits[0]
    ? `📦 ${produits[0].name}${produits.length > 1 ? ` +${produits.length - 1}` : ''} (${produits[0].qty || 1}x)`
    : '';
  const payload = JSON.stringify({
    title: `🛍️ Nouvelle commande${ville ? ` (${ville})` : ''}`,
    body: [`${nom}${prix}`, ville ? `📍 ${ville}` : '', ligneProduit].filter(Boolean).join('\n'),
    tag: `commande-${commande.id}`,
    url: '/store/commandes',
  });

  // Un abonnement expiré (410/404) ne doit pas faire échouer les autres —
  // et autant le retirer, il ne servira plus jamais.
  const perimes = [];
  let envoyes = 0;
  await Promise.all(abonnements.map(async (a) => {
    try {
      await webpush.sendNotification({ endpoint: a.endpoint, keys: a.keys }, payload);
      envoyes++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) perimes.push(a.endpoint);
    }
  }));
  if (perimes.length) await supabase.from('shop_push_subscriptions').delete().in('endpoint', perimes);

  res.status(200).json({ envoyes, perimes: perimes.length });
}
