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

/** « mobile » / « tablette » / « ordinateur » d'après le navigateur. */
export function typeAppareil(ua = '') {
  if (/iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(ua)) return 'tablette';
  if (/Mobi|iPhone|iPod|Android|BlackBerry|Opera Mini|IEMobile/i.test(ua)) return 'mobile';
  return 'ordinateur';
}

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
  return { visiteur, source: sourceVisite(window.location.search, document.referrer, ua), appareil: typeAppareil(ua) };
}

/* Tant que la colonne « appareil » n'existe pas encore en base (visites.sql
   pas relancé), l'insertion échoue : on renvoie alors la ligne sans elle,
   pour ne jamais perdre une visite. */
let sansAppareil = false;
function envoyer(ligne) {
  const l = sansAppareil ? { ...ligne, appareil: undefined } : ligne;
  try {
    supabase.from('shop_visites').insert(l).then(({ error } = {}) => {
      if (error && !sansAppareil && /appareil/i.test(error.message || '')) {
        sansAppareil = true;
        supabase.from('shop_visites').insert({ ...ligne, appareil: undefined }).then(() => {}, () => {});
      }
    }, () => {});
  } catch { /* table absente */ }
}

/** Une seule fois par onglet, par jour et par clé (évite de compter chaque rechargement). */
function premiereFois(cle) {
  const k = `victoury_${cle}_${jourLocal()}`;
  try {
    if (sessionStorage.getItem(k)) return false;
    sessionStorage.setItem(k, '1');
    return true;
  } catch { return false; }
}

/** Une visite par onglet et par jour (les changements de page ne comptent pas). */
export function enregistrerVisite() {
  const c = contexte();
  if (!c) return;
  if (!premiereFois('visite')) return;
  envoyer({ visiteur: c.visiteur, type: 'visite', source: c.source, appareil: c.appareil, page: window.location.pathname.slice(0, 200) });
}

/** Un ajout au panier (nom du produit pour le classement des produits). */
export function enregistrerAjoutPanier(nomProduit) {
  const c = contexte();
  if (!c) return;
  envoyer({ visiteur: c.visiteur, type: 'panier', source: c.source, appareil: c.appareil, produit: String(nomProduit || '').slice(0, 200) || null });
}

/** Fiche produit vue (une fois par produit et par onglet) — 2ᵉ étape de l'entonnoir. */
export function enregistrerVueProduit(nomProduit) {
  const c = contexte();
  if (!c || !premiereFois(`produit_${String(nomProduit || '').slice(0, 60)}`)) return;
  envoyer({ visiteur: c.visiteur, type: 'produit', source: c.source, appareil: c.appareil, produit: String(nomProduit || '').slice(0, 200) || null });
}

/** Formulaire de commande ouvert (une fois par onglet) — 4ᵉ étape de l'entonnoir. */
export function enregistrerDebutCommande() {
  const c = contexte();
  if (!c || !premiereFois('checkout')) return;
  envoyer({ visiteur: c.visiteur, type: 'checkout', source: c.source, appareil: c.appareil, page: window.location.pathname.slice(0, 200) });
}
