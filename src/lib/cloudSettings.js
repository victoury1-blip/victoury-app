import { supabase } from './supabase';

/* Supabase is the source of truth. localStorage is a write-through cache only. */
/* Single-tenant: no user_id scoping — all settings are shared across devices. */

export async function cloudGet(key) {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', key)
      .is('user_id', null)
      .maybeSingle();

    if (!error && data?.value !== undefined && data?.value !== null) {
      localStorage.setItem(key, JSON.stringify(data.value));
      return data.value;
    }

    // Fallback: try without user_id filter (catches old rows with user_id set)
    const { data: d2 } = await supabase
      .from('settings')
      .select('value')
      .eq('key', key)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (d2?.value !== undefined && d2?.value !== null) {
      localStorage.setItem(key, JSON.stringify(d2.value));
      // Migrate: re-save without user_id
      await supabase.from('settings').upsert(
        { key, value: d2.value, user_id: null, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
      return d2.value;
    }

    return null;
  } catch {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
}

export async function cloudSet(key, value) {
  try {
    const { error } = await supabase.from('settings').upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
    if (error) throw error;
  } catch (e) {
    console.error('cloudSet failed:', e?.message || e);
  }
  localStorage.setItem(key, JSON.stringify(value));
}

export function localGet(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
