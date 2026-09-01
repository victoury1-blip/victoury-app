/* D'où vient le visiteur qui commande.
 *
 * Deux indices, dans l'ordre : le paramètre `utm_source` de l'annonce
 * (posé volontairement par la campagne, donc le plus fiable) puis, à défaut,
 * le site d'où le navigateur arrive. Sans aucun des deux, la visite est
 * directe — favoris, saisie de l'adresse, ou application qui masque le
 * référent (Instagram et Facebook le font selon les réglages du téléphone).
 */
const CONNUS = {
  'instagram.com': 'Instagram', 'l.instagram.com': 'Instagram',
  'facebook.com': 'Facebook', 'l.facebook.com': 'Facebook', 'lm.facebook.com': 'Facebook',
  'tiktok.com': 'TikTok',
  'google.com': 'Google', 'google.co.ma': 'Google',
  'whatsapp.com': 'WhatsApp', 'wa.me': 'WhatsApp',
};

const depuisUtm = (recherche) => {
  const p = new URLSearchParams(recherche || '');
  const src = (p.get('utm_source') || '').toLowerCase();
  if (!src) return null;
  const trouve = Object.entries(CONNUS).find(([hote]) => hote.includes(src) || src.includes(hote.split('.')[0]));
  return trouve ? trouve[1] : src.charAt(0).toUpperCase() + src.slice(1);
};

const depuisReferent = (referent) => {
  if (!referent) return null;
  try {
    const hote = new URL(referent).hostname.replace(/^www\./, '');
    return CONNUS[hote] || null;
  } catch { return null; }
};

/** Source de la visite, déterminée une fois au chargement de la page. */
export function detecterSource(recherche = '', referent = '') {
  return depuisUtm(recherche) || depuisReferent(referent) || 'Direct';
}
