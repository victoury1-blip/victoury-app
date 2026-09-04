import { supabase } from './supabase';

/* Abonnement Push — contrairement à la Notification API simple
   (notifCommande.js), celui-ci réveille le navigateur même onglet fermé ou
   téléphone verrouillé. Un abonnement par APPAREIL (pas par compte) : chaque
   téléphone/PC qui a autorisé les notifications a le sien dans
   shop_push_subscriptions, et /api/push-notify les utilise tous à l'arrivée
   d'une commande du site. */

// Injectée au build (Vercel → Environment Variables) : la clé PUBLIQUE peut
// voyager côté client sans risque, seule la clé privée doit rester secrète.
const CLE_PUBLIQUE = import.meta.env.VITE_VAPID_PUBLIC_KEY;

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
 *  appareil, et l'enregistre en base. Idempotent : rappelable sans risque
 *  (ex. à chaque ouverture de /store) une fois la permission accordée. */
export async function activerPushCommande() {
  if (!pushDisponible()) return { ok: false, raison: 'non-supporte' };
  if (Notification.permission === 'denied') return { ok: false, raison: 'refuse' };
  if (Notification.permission === 'default') {
    const p = await Notification.requestPermission();
    if (p !== 'granted') return { ok: false, raison: 'refuse' };
  }
  try {
    const reg = await navigator.serviceWorker.register('/sw-push.js');
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(CLE_PUBLIQUE),
      });
    }
    const json = sub.toJSON();
    const { error } = await supabase.from('shop_push_subscriptions')
      .upsert({ endpoint: json.endpoint, keys: json.keys });
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (e) {
    return { ok: false, raison: e.message };
  }
}

export async function statutPush() {
  if (!pushDisponible()) return 'non-supporte';
  return Notification.permission;
}

/** L'abonnement de cet appareil est-il déjà enregistré ? Contrairement à
 *  activerPushCommande(), ne demande RIEN (ni permission ni abonnement) —
 *  juste un état à afficher au chargement de la page. Sans ça, revenir sur
 *  Réglages semblait "désactivé" à chaque fois (l'état local repart à zéro
 *  au remontage du composant) alors que l'abonnement, lui, était toujours là
 *  côté serveur — et redemander à chaque visite finissait par lasser. */
export async function abonnementDejaActif() {
  if (!pushDisponible() || Notification.permission !== 'granted') return false;
  try {
    // Sans argument : la registration qui contrôle CETTE page. Un argument
    // attend une URL de PAGE couverte par le scope du service worker, pas le
    // chemin du fichier JS lui-même ('/sw-push.js' n'est jamais une page) —
    // avec l'ancien appel, la recherche ne trouvait jamais rien et l'état
    // repassait à "non abonné" à chaque visite malgré un abonnement bien réel.
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}
