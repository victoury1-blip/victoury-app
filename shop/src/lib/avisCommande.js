import { FUSEAU } from './fuseau';

/* Message affiché à la caisse et sur la page « merci » pendant une absence
 * (voyage, fête…) : « confirmation lundi, livraison mardi ». Réglé dans
 * /store/reglages, avec une date de début et de fin pour qu'il apparaisse et
 * disparaisse tout seul. */

export const AVIS_DEFAUT = {
  actif: false,
  debut: '',
  fin: '',
  texteAr: '📅 الطلبات ديال هاد الأيام غنتاصلو بيك نأكدوها نهار الاثنين، والتوصيل نهار الثلاثاء إن شاء الله 🌸',
  texteFr: '📅 Les commandes de ces jours-ci seront confirmées lundi, livraison mardi.',
};

const jour = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: FUSEAU });

/** Le message à afficher maintenant ({ texteAr, texteFr }), ou null. */
export function avisCommandeActif(avis, maintenant = new Date()) {
  if (!avis?.actif) return null;
  const j = jour(maintenant);
  if (avis.debut && j < avis.debut) return null;
  if (avis.fin && j > avis.fin) return null;
  const texteAr = String(avis.texteAr || '').trim();
  const texteFr = String(avis.texteFr || '').trim();
  return texteAr || texteFr ? { texteAr: texteAr || texteFr, texteFr: texteFr || texteAr } : null;
}
