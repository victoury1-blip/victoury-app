// Envoi des notifications push « Nouvelle commande » vers tous les appareils
// abonnés (table shop_push_subscriptions). Partagé par :
//   - api/commande.js : envoi DIRECT juste après l'enregistrement de la
//     commande — ne dépend plus d'un webhook Supabase à configurer à part ;
//   - api/push-notify.js : webhook Supabase (si configuré) + bouton de test.
// Android remplace une notification qui porte le même `tag`
// (commande-<id>) : si les deux chemins envoient, une seule reste affichée.
// (Fichier préfixé « _ » : importable mais non exposé comme route.)

import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

/** Ce qui manque côté Vercel pour pouvoir envoyer (liste vide = tout est là). */
export function configManquante() {
  const manque = [];
  if (!(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)) manque.push('VITE_SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) manque.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!(process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY)) manque.push('VAPID_PUBLIC_KEY');
  if (!process.env.VAPID_PRIVATE_KEY) manque.push('VAPID_PRIVATE_KEY');
  return manque;
}

export function payloadCommande(commande) {
  const nom = commande.recipient?.name || 'Client';
  const ville = commande.recipient?.city || '';
  const prix = commande.price ? ` — ${commande.price} DH` : '';
  const produits = commande.products?.length ? commande.products : (commande.product ? [commande.product] : []);
  const ligneProduit = produits[0]
    ? `📦 ${produits[0].name}${produits.length > 1 ? ` +${produits.length - 1}` : ''} (${produits[0].qty || 1}x)`
    : '';
  return {
    title: `🛍️ Nouvelle commande${ville ? ` (${ville})` : ''}`,
    body: [`${nom}${prix}`, ville ? `📍 ${ville}` : '', ligneProduit].filter(Boolean).join('\n'),
    tag: `commande-${commande.id}`,
    url: '/store/commandes',
  };
}

/**
 * Envoie `payload` à tous les abonnés (ou seulement à `endpoint` s'il est donné).
 * Ne lève jamais : renvoie { envoyes, abonnes, perimes, erreurs[], manque[] }.
 */
export async function envoyerPush(payload, { endpoint } = {}) {
  const manque = configManquante();
  if (manque.length) return { envoyes: 0, abonnes: 0, perimes: 0, erreurs: [], manque };
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:contact@victoury-maroc.com',
      process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );
    const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    let q = supabase.from('shop_push_subscriptions').select('endpoint, keys');
    if (endpoint) q = q.eq('endpoint', endpoint);
    const { data: abonnements, error } = await q;
    if (error) return { envoyes: 0, abonnes: 0, perimes: 0, erreurs: [error.message], manque: [] };
    const texte = JSON.stringify(payload);
    const perimes = [];
    const erreurs = [];
    let envoyes = 0;
    await Promise.all((abonnements || []).map(async (a) => {
      try {
        // TTL 1 jour + urgence haute : Android réveille le téléphone même en
        // veille (Doze) au lieu de retarder la notification.
        await webpush.sendNotification({ endpoint: a.endpoint, keys: a.keys }, texte, { TTL: 86400, urgency: 'high' });
        envoyes++;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) perimes.push(a.endpoint);
        else erreurs.push(`${e.statusCode || ''} ${String(e.body || e.message || '').slice(0, 120)}`.trim());
      }
    }));
    if (perimes.length) await supabase.from('shop_push_subscriptions').delete().in('endpoint', perimes);
    return { envoyes, abonnes: abonnements?.length || 0, perimes: perimes.length, erreurs, manque: [] };
  } catch (e) {
    return { envoyes: 0, abonnes: 0, perimes: 0, erreurs: [String(e.message || e)], manque: [] };
  }
}
