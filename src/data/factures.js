import { supabase } from '../lib/supabase';

const KEY = 'victoury_factures';
const CTR_KEY = 'victoury_fct_counter';

export function loadFactures() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
export function saveFactures(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
  supabase.from('settings')
    .upsert({ key: KEY, value: list, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    .then(() => {});
}
export async function loadFacturesRemote() {
  try {
    const { data, error } = await supabase.from('settings').select('value').eq('key', KEY).single();
    if (!error && data?.value && Array.isArray(data.value)) {
      localStorage.setItem(KEY, JSON.stringify(data.value));
      return data.value;
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
