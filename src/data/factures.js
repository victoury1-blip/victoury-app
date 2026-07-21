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
export function saveFactures(list) {
  const clean = dedupeFactures(list);
  localStorage.setItem(KEY, JSON.stringify(clean));
  cloudSet(KEY, clean);
}
export async function loadFacturesRemote() {
  try {
    const remote = await cloudGet(KEY);
    if (Array.isArray(remote)) {
      const clean = dedupeFactures(remote);
      localStorage.setItem(KEY, JSON.stringify(clean));
      return clean;
    }
  } catch {}
  return null;
}

export async function nextRef() {
  const d = new Date();
  const dd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  try {
    const { data, error } = await supabase.rpc('next_fct_id');
    if (!error && data) return `FCT-${dd}-${String(data).padStart(4,'0')}`;
  } catch {}
  const n = parseInt(localStorage.getItem(CTR_KEY) || '0', 10) + 1;
  localStorage.setItem(CTR_KEY, String(n));
  return `FCT-${dd}-${String(n).padStart(4,'0')}`;
}

export const ELIGIBLE_STATUSES = ['livre', 'refuse', 'annule', 'change'];

export function statusLabel(s) {
  return { livre: 'Livré', refuse: 'Refusé', annule: 'Annulé', change: 'Échangé' }[s] || s;
}
