import { supabase } from './supabase';

/* Supabase is the source of truth. localStorage is a write-through cache only. */

export async function cloudGet(key) {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', key)
      .single();
    if (!error && data?.value !== undefined && data?.value !== null) {
      localStorage.setItem(key, JSON.stringify(data.value));
      return data.value;
    }
    /* Supabase returned nothing for this key (not saved yet) */
    return null;
  } catch {
    /* Offline fallback: use localStorage cache */
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
}

export async function cloudSet(key, value) {
  /* Write to Supabase first, then cache in localStorage */
  try {
    await supabase.from('settings').upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
  } catch {}
  localStorage.setItem(key, JSON.stringify(value));
}

export function localGet(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
