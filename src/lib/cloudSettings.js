import { supabase } from './supabase';

async function uid() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

export async function cloudGet(key) {
  try {
    const userId = await uid();

    // Try with user_id first
    if (userId) {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', key)
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      if (data?.value !== undefined && data?.value !== null) {
        localStorage.setItem(key, JSON.stringify(data.value));
        return data.value;
      }
    }

    // Fallback: try user_id IS NULL
    const { data: d2, error: e2 } = await supabase
      .from('settings')
      .select('value')
      .eq('key', key)
      .is('user_id', null)
      .maybeSingle();
    if (e2) throw e2;
    if (d2?.value !== undefined && d2?.value !== null) {
      localStorage.setItem(key, JSON.stringify(d2.value));
      if (userId) {
        // Migrate to user-scoped row
        await supabase.from('settings').insert(
          { key, value: d2.value, user_id: userId, updated_at: new Date().toISOString() }
        ).then(() => {
          supabase.from('settings').delete().eq('key', key).is('user_id', null);
        });
      }
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
  // QuotaExceededError (gros produits/factures) ne doit pas empêcher l'écriture cloud.
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  try {
    const userId = await uid();
    const row = { key, value, updated_at: new Date().toISOString() };
    if (userId) row.user_id = userId;

    if (userId) {
      const { error } = await supabase.from('settings').upsert(row, {
        onConflict: 'key,user_id',
      });
      if (!error) {
        await supabase.from('settings').delete().eq('key', key).is('user_id', null);
        return;
      }
    }

    // NULL user_id: upsert won't dedupe NULLs, so delete+insert
    await supabase.from('settings').delete().eq('key', key).is('user_id', null);
    if (userId) {
      await supabase.from('settings').delete().eq('key', key).eq('user_id', userId);
    }
    const { error: e2 } = await supabase.from('settings').insert(row);
    if (e2) throw e2;
  } catch (e) {
    console.error('cloudSet failed:', key, e?.message || e);
  }
}

export function localGet(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
