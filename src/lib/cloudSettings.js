import { supabase } from './supabase';

/* Supabase is the source of truth. localStorage is a write-through cache only. */

async function getUserId() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch { return null; }
}

export async function cloudGet(key) {
  try {
    const userId = await getUserId();
    let query = supabase.from('settings').select('value').eq('key', key);
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query.single();
    if (!error && data?.value !== undefined && data?.value !== null) {
      localStorage.setItem(key, JSON.stringify(data.value));
      return data.value;
    }
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
    const userId = await getUserId();
    const row = { key, value, updated_at: new Date().toISOString() };
    if (userId) row.user_id = userId;
    const { error } = await supabase.from('settings').upsert(row, { onConflict: 'key' });
    if (error) throw error;
  } catch (e) {
    console.error('cloudSet failed:', e?.message || e);
  }
  localStorage.setItem(key, JSON.stringify(value));
}

export function localGet(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
