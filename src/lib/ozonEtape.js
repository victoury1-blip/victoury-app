/* Dernière étape Ozon d'un colis, avec son commentaire.
 *
 * Le statut seul (« Retourné ») ne dit pas où se trouve le colis : c'est le
 * commentaire de la dernière ligne d'historique qui le précise — « Reçu par
 * Agence GRAND CASA », « Distribué par ramasseur / En Agence », « Reçu par
 * client »… C'est ce qu'il faut lire pour savoir s'il faut passer à l'agence.
 */
/* Chargé à la demande : le module reste testable sans client Supabase. */
const cloud = () => import('./cloudSettings');

// v2 : les anciennes entrées avaient perdu « Reporté pour : <date> » (voir plus bas).
const CACHE_KEY = 'ozon_etapes_v2';

/** Commentaire Ozon lisible : sans HTML, sans « | Commentaire : ». */
export function nettoyerCommentaire(raw) {
  let t = String(raw || '');
  // Ozon échappe parfois deux fois (« &amp;lt;b&amp;gt; ») : on décode &amp; d'abord.
  for (let i = 0; i < 3 && /&amp;/.test(t); i++) t = t.replace(/&amp;/g, '&');
  return t
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    // « Pas de commentaire fourni » ne dit rien, mais il ne doit pas effacer le
    // reste de la ligne (« Reporté pour : 2026-10-30 | Livreur : … »).
    .replace(/Commentaire\s*:\s*Pas de commentaire fourni\.?/gi, '')
    .replace(/Pas de commentaire fourni\.?/gi, '')
    .replace(/Commentaire\s*:\s*/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/(\s*\|\s*)+/g, ' | ')
    .replace(/^\s*\|\s*|\s*\|\s*$/g, '')
    .trim();
}

const dateDe = (h) => String(h?.TIME_STR || h?.DATE || h?.date || '');
const statutDe = (h) => String(h?.STATUT || h?.STATUS || h?.status || '');

/** Dernière ligne d'historique (la plus récente), ou null. */
export function derniereEtape(histList) {
  const list = (Array.isArray(histList) ? histList : Object.values(histList || {})).filter(Boolean);
  if (!list.length) return null;
  // Les dates « aaaa-mm-jj hh:mm » se trient comme du texte ; sans date, l'ordre reçu fait foi.
  const indexees = list.map((h, i) => ({ h, i }));
  indexees.sort((a, b) => dateDe(a.h).localeCompare(dateDe(b.h)) || a.i - b.i);
  const h = indexees[indexees.length - 1].h;
  const commentaire = nettoyerCommentaire(h.COMMENT);
  return {
    statut: statutDe(h),
    commentaire,
    date: dateDe(h),
  };
}

export function lireEtapesCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') || {}; } catch { return {}; }
}

export function ecrireEtapeCache(id, etape) {
  const all = lireEtapesCache();
  all[id] = { ...etape, at: Date.now() };
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(all)); } catch { /* quota */ }
  return all[id];
}

async function configOzon() {
  let cfg = {};
  try { cfg = JSON.parse(localStorage.getItem('auzone_config') || '{}'); } catch { /* vide */ }
  if (!cfg.customerId || !cfg.apiKey) {
    try {
      const remote = await cloud().then(m => m.cloudGet('auzone_config'));
      if (remote?.customerId && remote?.apiKey) cfg = remote;
    } catch { /* hors ligne */ }
  }
  return cfg.customerId && cfg.apiKey ? cfg : null;
}

/** Interroge Ozon pour un colis ; null si introuvable ou non configuré. */
export async function chargerEtapeOzon(order) {
  const cfg = await configOzon();
  if (!cfg) return null;
  const base = `https://api.ozonexpress.ma/customers/${cfg.customerId}/${cfg.apiKey}`;
  const codes = [...new Set([order.trackingNumber, order.ozoneTracking, order.id].filter(Boolean))];
  for (const tn of codes) {
    const body = new FormData();
    body.append('tracking-number', tn);
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 10000);
    try {
      const res = await fetch(`${base}/tracking`, { method: 'POST', body, signal: ac.signal });
      clearTimeout(t);
      if (!res.ok) continue;
      const json = await res.json();
      const track = json?.TRACKING || json || {};
      if (String(track.RESULT || '').toUpperCase() === 'ERROR') continue;
      const etape = derniereEtape(track.HISTORY || track['PARCEL-HISTORY'] || track.history);
      const last = track.LAST_TRACKING || track['LAST-TRACKING'] || {};
      const statut = etape?.statut || last.STATUT || last.STATUS || '';
      if (!statut && !etape) continue;
      return { statut, commentaire: etape?.commentaire || '', date: etape?.date || '' };
    } catch {
      clearTimeout(t);
    }
  }
  return null;
}
