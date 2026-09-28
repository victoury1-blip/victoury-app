import { supabase } from './supabase';

/* Abonnement Push — contrairement à la Notification API simple
   (useOrderNotifications.js), celui-ci réveille le téléphone même app
   fermée ou écran verrouillé. Un abonnement par APPAREIL (pas par compte) :
   chaque téléphone/PC qui a autorisé les notifications a le sien dans
   push_subscriptions, et /api/push-notify les utilise tous à l'arrivée
   d'une commande venant du site (voir ce fichier). Même principe que
   shop/src/lib/pushNotif.js. */

const CLE_PUBLIQUE = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// Portée dédiée, distincte de la racine '/' : le service worker Workbox de
// l'app (vite-plugin-pwa, voir vite.config.js) se réenregistre lui-même à
// CHAQUE chargement de page sur la portée '/' — il est volontairement
// "selfDestroying" et se désinstalle aussitôt. Si le SW du push utilisait
// aussi la portée '/', ce cycle finissait par emporter avec lui
// l'enregistrement du push (abonnement retrouvé actif juste après l'avoir
// activé, mais reperdu au rechargement suivant). Une portée à lui seul
// évite tout chevauchement entre les deux enregistrements.
const PORTEE = '/push-scope/';

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const brut = atob(base64Safe);
  return Uint8Array.from([...brut].map(c => c.charCodeAt(0)));
}

export function pushDisponible() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && !!CLE_PUBLIQUE;
}

/** Demande la permission puis crée (ou réutilise) l'abonnement Push de cet
 *  appareil, et l'enregistre en base. Idempotent. */
export async function activerPushCommande() {
  if (!pushDisponible()) return { ok: false, raison: 'non-supporte' };
  if (Notification.permission === 'denied') return { ok: false, raison: 'refuse' };
  if (Notification.permission === 'default') {
    const p = await Notification.requestPermission();
    if (p !== 'granted') return { ok: false, raison: 'refuse' };
  }
  try {
    const reg = await navigator.serviceWorker.register('/sw-push.js', { scope: PORTEE });
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(CLE_PUBLIQUE),
      });
    }
    const json = sub.toJSON();
    const { error } = await supabase.from('push_subscriptions')
      .upsert({ endpoint: json.endpoint, keys: json.keys });
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (e) {
    return { ok: false, raison: e.message };
  }
}

/** Retire l'abonnement de cet appareil (désactivation manuelle). */
export async function desactiverPushCommande() {
  try {
    const reg = await navigator.serviceWorker.getRegistration(PORTEE);
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    }
  } catch { /* rien à faire si déjà absent */ }
}

export async function statutPush() {
  if (!pushDisponible()) return 'non-supporte';
  return Notification.permission;
}

/** L'abonnement de cet appareil est-il déjà enregistré ? Ne demande RIEN. */
export async function abonnementDejaActif() {
  if (!pushDisponible() || Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration(PORTEE);
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}
