import { cloudGet, cloudSet } from '../lib/cloudSettings';
import { supabase } from '../lib/supabase';

const KEY = 'victoury_factures';
const CTR_KEY = 'victoury_fct_counter';

// Déduplique les factures : par id unique, et à défaut par (ref + dateCreation) pour
// nettoyer d'anciens doublons créés avec un même id (id == ref à l'époque).
export function dedupeFactures(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const f of list) {
    if (!f) continue;
    const key = `${f.id || ''}|${f.ref || ''}|${f.dateCreation || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

export function loadFactures() {
  try { return dedupeFactures(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { return []; }
}

/* ── Plusieurs appareils ──
 * Les factures vivent dans UNE ligne « settings » (toute la liste). Écrire la
 * liste entière depuis un appareil qui ne connaissait pas encore la facture
 * créée sur un autre téléphone l'effaçait. On fusionne donc facture par
 * facture (la plus récemment modifiée gagne, `majLe`), et les suppressions
 * sont retenues dans une liste à part pour ne pas « ressusciter ». */
export const KEY_SUPPR = 'victoury_factures_supprimees';

export function lireSupprimees() {
  try { const v = JSON.parse(localStorage.getItem(KEY_SUPPR) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}

/** Union par id ; pour une même facture, la plus récente (`majLe`) gagne, sinon `a`. */
export function fusionnerFactures(a = [], b = [], supprimees = []) {
  const suppr = new Set(supprimees);
  const parId = new Map();
  for (const f of [...(Array.isArray(b) ? b : []), ...(Array.isArray(a) ? a : [])]) {
    if (!f || suppr.has(f.id)) continue;
    const k = f.id || `${f.ref}|${f.dateCreation}`;
    const deja = parId.get(k);
    if (!deja || (Number(f.majLe) || 0) >= (Number(deja.majLe) || 0)) parId.set(k, f);
  }
  return dedupeFactures([...parId.values()]);
}

function publier(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* quota */ }
  // Différé : saveFactures est appelé depuis des mises à jour d'état React.
  setTimeout(() => {
    try { window.dispatchEvent(new CustomEvent('factures:maj', { detail: list })); } catch { /* hors navigateur */ }
  }, 0);
}

async function supprimeesCloud() {
  const remote = await cloudGet(KEY_SUPPR).catch(() => null);
  const toutes = [...new Set([...(Array.isArray(remote) ? remote : []), ...lireSupprimees()])];
  try { localStorage.setItem(KEY_SUPPR, JSON.stringify(toutes)); } catch { /* quota */ }
  return toutes;
}

/** Enregistre la liste de CET appareil, fusionnée avec celle du cloud. */
export function saveFactures(list) {
  const local = fusionnerFactures(list, [], lireSupprimees());
  publier(local);
  return (async () => {
    try {
      const [remote, suppr] = await Promise.all([cloudGet(KEY).catch(() => null), supprimeesCloud()]);
      const fusion = fusionnerFactures(local, Array.isArray(remote) ? remote : [], suppr);
      await cloudSet(KEY, fusion);
      publier(fusion);
      return fusion;
    } catch {
      cloudSet(KEY, local);
      return local;
    }
  })();
}

/** Supprime une facture partout (et l'empêche de revenir depuis un autre appareil). */
export async function supprimerFacture(id, list) {
  const suppr = [...new Set([...lireSupprimees(), id])];
  try { localStorage.setItem(KEY_SUPPR, JSON.stringify(suppr)); } catch { /* quota */ }
  const remote = await cloudGet(KEY_SUPPR).catch(() => null);
  await cloudSet(KEY_SUPPR, [...new Set([...(Array.isArray(remote) ? remote : []), ...suppr])]);
  return saveFactures((list || loadFactures()).filter(f => f.id !== id));
}

export async function loadFacturesRemote() {
  try {
    const [remote, suppr] = await Promise.all([cloudGet(KEY), supprimeesCloud()]);
    if (Array.isArray(remote)) {
      const local = loadFactures();
      const fusion = fusionnerFactures(remote, local, suppr);
      publier(fusion);
      // Une facture restée sur cet appareil seulement repart vers le cloud.
      const idsRemote = new Set(remote.map(f => f?.id));
      if (fusion.some(f => !idsRemote.has(f.id))) cloudSet(KEY, fusion);
      return fusion;
    }
  } catch {}
  return null;
}

export async function nextRef() {
  const d = new Date();
  const dd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  // Plancher = plus grand numéro déjà utilisé, pour ne JAMAIS réémettre un numéro existant.
  let maxUsed = 0;
  try {
    loadFactures().forEach(f => {
      const m = /(\d+)\s*$/.exec(f?.ref || '');
      if (m) maxUsed = Math.max(maxUsed, parseInt(m[1], 10));
    });
  } catch {}
  let n = 0;
  try {
    const { data, error } = await supabase.rpc('next_fct_id');
    if (!error && data) n = Math.max(parseInt(data, 10) || 0, maxUsed + 1);
  } catch {}
  if (!n) {
    const stored = parseInt(localStorage.getItem(CTR_KEY) || '0', 10) || 0;
    n = Math.max(stored, maxUsed) + 1;
  }
  localStorage.setItem(CTR_KEY, String(n));
  return `FCT-${dd}-${String(n).padStart(4,'0')}`;
}

export const ELIGIBLE_STATUSES = ['livre', 'refuse', 'annule', 'change'];

export function statusLabel(s) {
  return { livre: 'Livré', refuse: 'Refusé', annule: 'Annulé', change: 'Échangé' }[s] || s;
}
