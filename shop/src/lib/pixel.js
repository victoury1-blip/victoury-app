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

/* TikTok Pixel — même logique que Meta : chargé une seule fois avec le
   boilerplate officiel TikTok, un `ttq.track` par évènement standard
   (ViewContent, AddToCart, InitiateCheckout, CompletePayment). Aucune API
   de conversions serveur ici — le pixel navigateur seul, comme Clarity. */
let ttqCharge = false;
export function chargerTikTokPixel(pixelId) {
  if (ttqCharge || !pixelId || typeof window === 'undefined') return;
  ttqCharge = true;
  /* eslint-disable */
  !function (w, d, t) {
    w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<e.methods.length;n++)ttq.setAndDefer(e,e.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=i+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
    // autoConfig:false — sans ça, TikTok scanne la page tout seul pour
    // deviner les données produit (Automatic Advanced Matching) et plante
    // (TypeError sur une page qu'il ne sait pas lire, comme /commander).
    // On envoie déjà chaque évènement à la main (trackTikTok), ce scan
    // automatique ne sert à rien ici.
    ttq.load(pixelId, { autoConfig: false });
    ttq.page();
  }(window, document, 'ttq');
  /* eslint-enable */
}

/** Émet un évènement navigateur TikTok, sans effet si le pixel n'est pas chargé. */
export function trackTikTok(nom, donnees) {
  if (typeof window === 'undefined' || !window.ttq) return;
  window.ttq.track(nom, donnees || {});
}

/* Relais serveur (Events API) — même principe que envoyerCAPI pour Meta : le
 * jeton reste côté serveur (TIKTOK_ACCESS_TOKEN sur Vercel), voir
 * api/tiktok-capi.js. Le pixel navigateur peut planter à l'initialisation
 * selon la page (constaté sur /commander) sans que ça n'affecte ce relais. */
export async function envoyerTikTokCAPI(pixelId, evenements, testCode) {
  try {
    await fetch('/api/tiktok-capi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pixelId, events: evenements, testCode: testCode || undefined }),
    });
  } catch { /* la publicité continue d'apprendre par le seul pixel navigateur, s'il a pu se charger */ }
}

/* Microsoft Clarity — chargé une seule fois, avec le boilerplate officiel.
   Contrairement à Meta, aucun jeton n'est jamais impliqué côté navigateur :
   l'identifiant de projet n'a rien d'un secret. */
let clarityCharge = false;
export function chargerClarity(projectId) {
  if (clarityCharge || !projectId || typeof window === 'undefined') return;
  clarityCharge = true;
  /* eslint-disable */
  (function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
  })(window, document, "clarity", "script", projectId);
  /* eslint-enable */
}
