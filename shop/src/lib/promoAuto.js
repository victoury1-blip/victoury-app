/* Code promo transmis par un lien (pub de retargeting) : victoury-maroc.com/?code=RETOUR30.
   Gardé quelques jours sur l'appareil, puisque le client arrive sur une page
   et passe commande souvent plus tard, après avoir navigué ou fermé l'onglet.
   Aucun champ à remplir : seuls ceux qui ont reçu le lien profitent de la
   remise, le champ « code promo » peut rester masqué pour tout le monde. */

const CLE = 'victoury_promo_auto';
const DUREE_MS = 14 * 24 * 3600 * 1000;

export function capturerCodeUrl(search, maintenant = Date.now()) {
  try {
    const code = new URLSearchParams(search || '').get('code');
    const propre = String(code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 40);
    if (!propre) return null;
    localStorage.setItem(CLE, JSON.stringify({ code: propre, at: maintenant }));
    return propre;
  } catch { return null; }
}

export function lireCodeAuto(maintenant = Date.now()) {
  try {
    const v = JSON.parse(localStorage.getItem(CLE) || 'null');
    if (!v?.code || maintenant - (v.at || 0) > DUREE_MS) return null;
    return v.code;
  } catch { return null; }
}

export function oublierCodeAuto() {
  try { localStorage.removeItem(CLE); } catch { /* stockage indisponible */ }
}

/* Ligne ajoutée aux messages WhatsApp pré-remplis quand le client est arrivé
   par un lien de pub avec code : en lisant le message, l'équipe sait tout de
   suite qu'il vient du retargeting et qu'il faut lui appliquer la remise. */
export function lignePromoWhatsApp(ar, maintenant = Date.now()) {
  const code = lireCodeAuto(maintenant);
  if (!code) return '';
  return ar
    ? `\n🎁 بغيت نستافد من التخفيض ديال الإعلان (كود ${code})`
    : `\n🎁 Je souhaite profiter de la remise de la pub (code ${code})`;
}
