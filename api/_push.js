// Envoi d'une notification push à tous les appareils abonnés (table
// push_subscriptions) — partagé par push-notify.js (nouvelle commande) et
// ozon-webhook.js (colis en danger). Les abonnements expirés sont purgés.
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

/** Envoie `message` ({ title, body, tag, url }). Renvoie { envoyes } ou { erreur }. */
export async function envoyerPush(message) {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!url || !serviceKey || !vapidPublic || !vapidPrivate) {
    return { erreur: 'Push non configuré (variables VAPID / clé de service manquantes)' };
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:contact@victoury-maroc.com', vapidPublic, vapidPrivate);

  const supabase = createClient(url, serviceKey);
  const { data: abonnements, error } = await supabase.from('push_subscriptions').select('endpoint, keys');
  if (error) return { erreur: error.message };
  if (!abonnements?.length) return { envoyes: 0, perimes: 0 };

  const payload = JSON.stringify(message);
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
  if (perimes.length) await supabase.from('push_subscriptions').delete().in('endpoint', perimes);
  return { envoyes, perimes: perimes.length };
}
