import { cloudGet, cloudSet } from '../lib/cloudSettings';

const KEY = 'victoury_factures';
const CTR_KEY = 'victoury_fct_counter';

export function loadFactures() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
export function saveFactures(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
  cloudSet(KEY, list);
}
export async function loadFacturesRemote() {
  try {
    const remote = await cloudGet(KEY);
    if (Array.isArray(remote)) {
      localStorage.setItem(KEY, JSON.stringify(remote));
      return remote;
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
  /* fallback localStorage */
  const n = parseInt(localStorage.getItem(CTR_KEY) || '0', 10) + 1;
  localStorage.setItem(CTR_KEY, String(n));
  return `FCT-${dd}-${String(n).padStart(4,'0')}`;
}

/** Eligible order statuses for facturation */
export const ELIGIBLE_STATUSES = ['livre', 'refuse', 'annule', 'change'];

export function statusLabel(s) {
  return { livre: 'Livré', refuse: 'Refusé', annule: 'Annulé', change: 'Échangé' }[s] || s;
}
