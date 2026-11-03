import { supabase } from './supabase';
import { sourceVisite } from './source';

/* Statistiques de visites maison (table shop_visites, voir visites.sql) :
 * le tableau de bord affiche Sessions / Ajouts au panier / Conversion sans
 * dépendre d'un compte Google Analytics. Aucune donnée personnelle : un
 * identifiant aléatoire par navigateur. Tout échec est silencieux — la
 * boutique ne doit jamais souffrir d'une statistique. */

const ROBOT = /bot|crawl|spider|slurp|headless|lighthouse|facebookexternalhit|preview|pingdom|vercel/i;
const CLE_VISITEUR = 'victoury_visiteur';

const jourLocal = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Casablanca' });

export function estRobot(ua = '') { return !ua || ROBOT.test(ua); }

function idVisiteur() {
  try {
    let id = localStorage.getItem(CLE_VISITEUR);
    if (!id) {
      id = (crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`);
      localStorage.setItem(CLE_VISITEUR, id);
    }
    return id;
  } catch { return null; }
}

function contexte() {
  if (typeof window === 'undefined') return null;
  const ua = navigator.userAgent || '';
  if (estRobot(ua) || window.location.pathname.startsWith('/store')) return null;
  const visiteur = idVisiteur();
  if (!visiteur) return null;
  return { visiteur, source: sourceVisite(window.location.search, document.referrer, ua) };
}

function envoyer(ligne) {
  try { supabase.from('shop_visites').insert(ligne).then(() => {}, () => {}); } catch { /* table absente */ }
}

/** Une visite par onglet et par jour (les changements de page ne comptent pas). */
export function enregistrerVisite() {
  const c = contexte();
  if (!c) return;
  const cle = `victoury_visite_${jourLocal()}`;
  try {
    if (sessionStorage.getItem(cle)) return;
    sessionStorage.setItem(cle, '1');
  } catch { return; }
  envoyer({ visiteur: c.visiteur, type: 'visite', source: c.source, page: window.location.pathname.slice(0, 200) });
}

/** Un ajout au panier (nom du produit pour le classement des produits). */
export function enregistrerAjoutPanier(nomProduit) {
  const c = contexte();
  if (!c) return;
  envoyer({ visiteur: c.visiteur, type: 'panier', source: c.source, produit: String(nomProduit || '').slice(0, 200) || null });
}
