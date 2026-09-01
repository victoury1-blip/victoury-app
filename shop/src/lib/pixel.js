/* Meta Pixel — ce que la publicité apprend de la boutique.
 *
 * Deux voies, comme chez tout annonceur sérieux : le pixel du NAVIGATEUR
 * (rapide, mais bloqué par les bloqueurs de pub et Safari) et l'API de
 * Conversions côté SERVEUR (fiable, jamais bloquée). Les deux envoient le même
 * `event_id` pour le même achat : Meta déduplique et ne compte la vente
 * qu'une fois.
 *
 * Le jeton d'accès à l'API de Conversions n'apparaît NULLE PART ici : il vit
 * en variable d'environnement sur le serveur (voir api/meta-capi.js), jamais
 * dans le code envoyé au navigateur ni dans la base de données publique.
 */

let charge = false;

/** Empreinte SHA-256 en minuscules, telle que Meta l'attend pour l'API de Conversions. */
export async function sha256(valeur) {
  const data = new TextEncoder().encode(String(valeur));
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Numéro au format international sans « + », seule forme acceptée par Meta. */
export function telephonePourMeta(tel) {
  const s = String(tel || '').replace(/[\s\-.()]/g, '');
  if (!s) return '';
  if (s.startsWith('0')) return '212' + s.slice(1);
  return s.replace(/^\+/, '');
}

/** Identifiant d'évènement — le même côté navigateur et côté serveur, pour dédupliquer. */
export function idEvenement(prefixe) {
  return `${prefixe}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/* Charge le pixel du navigateur une seule fois. Le code injecté est le
   boilerplate officiel de Meta — rien d'autre n'y transite. */
export function chargerPixel(pixelId) {
  if (charge || !pixelId || typeof window === 'undefined') return;
  charge = true;
  /* eslint-disable */
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
  document,'script','https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  window.fbq('init', pixelId);
  window.fbq('track', 'PageView');
}

/** Émet un évènement côté navigateur, sans effet si le pixel n'est pas chargé. */
export function trackPixel(nom, donnees, eventID) {
  if (typeof window === 'undefined' || !window.fbq) return;
  window.fbq('track', nom, donnees || {}, eventID ? { eventID } : undefined);
}

/* Relais serveur (API de Conversions) — le jeton reste côté serveur, dans une
 * variable d'environnement Vercel (voir api/meta-capi.js). L'identifiant du
 * pixel n'est pas un secret : c'est la même valeur que le pixel du navigateur
 * expose déjà à quiconque ouvre les outils de développement. */
export async function envoyerCAPI(pixelId, evenements, testCode) {
  try {
    await fetch('/api/meta-capi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pixelId, events: evenements, testCode: testCode || undefined }),
    });
  } catch { /* la publicité continue d'apprendre par le seul pixel navigateur */ }
}
