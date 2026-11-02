/* D'où vient le visiteur qui commande.
 *
 * Indices, dans l'ordre :
 *  1. `utm_source` de l'annonce (posé volontairement par la campagne) ;
 *  2. l'identifiant de clic ajouté automatiquement par la régie
 *     (`fbclid` Meta, `ttclid` TikTok, `gclid` Google) ;
 *  3. le site d'où le navigateur arrive (référent) ;
 *  4. le navigateur intégré de l'application (Instagram, Facebook, TikTok),
 *     reconnaissable à son user-agent même quand le référent est masqué.
 *
 * La source doit être lue À L'ARRIVÉE : au moment de commander, l'adresse
 * est /commander et le référent est le site lui-même — tout serait « Direct ».
 * memoriserSource() la garde donc dès le chargement (30 jours), et
 * sourceVisite() la relit à l'envoi de la commande.
 */
const CONNUS = {
  'instagram.com': 'Instagram', 'l.instagram.com': 'Instagram',
  'facebook.com': 'Facebook', 'l.facebook.com': 'Facebook', 'lm.facebook.com': 'Facebook', 'm.facebook.com': 'Facebook',
  'tiktok.com': 'TikTok',
  'google.com': 'Google', 'google.co.ma': 'Google',
  'whatsapp.com': 'WhatsApp', 'wa.me': 'WhatsApp',
};

// Valeurs de {{site_source_name}} chez Meta, et abréviations courantes.
const ALIAS = { ig: 'Instagram', fb: 'Facebook', an: 'Facebook', msg: 'Facebook', meta: 'Facebook', tt: 'TikTok', wa: 'WhatsApp' };

const depuisUtm = (p) => {
  const src = (p.get('utm_source') || '').toLowerCase().trim();
  if (!src) return null;
  if (ALIAS[src]) return ALIAS[src];
  const trouve = Object.entries(CONNUS).find(([hote]) => hote.includes(src) || src.includes(hote.split('.')[0]));
  return trouve ? trouve[1] : src.charAt(0).toUpperCase() + src.slice(1);
};

const depuisClic = (p, ua) => {
  if (p.get('fbclid')) return /instagram/i.test(ua) ? 'Instagram' : 'Facebook';
  if (p.get('ttclid')) return 'TikTok';
  if (p.get('gclid') || p.get('gbraid') || p.get('wbraid')) return 'Google';
  return null;
};

const depuisReferent = (referent) => {
  if (!referent) return null;
  try {
    const hote = new URL(referent).hostname.replace(/^www\./, '');
    return CONNUS[hote] || null;
  } catch { return null; }
};

const depuisNavigateur = (ua) => {
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return 'Facebook';
  if (/musical_ly|BytedanceWebview|TikTok/i.test(ua)) return 'TikTok';
  return null;
};

/** Source de la visite d'après l'adresse, le référent et le navigateur. */
export function detecterSource(recherche = '', referent = '', ua = '') {
  const p = new URLSearchParams(recherche || '');
  return depuisUtm(p) || depuisClic(p, ua) || depuisReferent(referent) || depuisNavigateur(ua) || 'Direct';
}

const CLE = 'victoury_source';
const DUREE = 30 * 24 * 3600 * 1000;

/** À l'arrivée sur le site : garde la source si elle est connue (la dernière gagne). */
export function memoriserSource(recherche, referent, ua, maintenant = Date.now()) {
  const s = detecterSource(recherche, referent, ua);
  if (s === 'Direct') return;
  try { localStorage.setItem(CLE, JSON.stringify({ s, at: maintenant })); } catch { /* stockage indisponible */ }
}

/** À l'envoi de la commande : la source gardée, sinon celle de la page actuelle. */
export function sourceVisite(recherche, referent, ua, maintenant = Date.now()) {
  const ici = detecterSource(recherche, referent, ua);
  if (ici !== 'Direct') return ici;
  try {
    const m = JSON.parse(localStorage.getItem(CLE) || 'null');
    if (m?.s && maintenant - (m.at || 0) < DUREE) return m.s;
  } catch { /* stockage indisponible */ }
  return 'Direct';
}
