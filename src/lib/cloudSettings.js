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
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', key)
        .eq('user_id', userId)
        .maybeSingle();
      if (data?.value !== undefined && data?.value !== null) {
        localStorage.setItem(key, JSON.stringify(data.value));
        return data.value;
      }
    }

    // Fallback: try user_id IS NULL
    const { data: d2 } = await supabase
      .from('settings')
      .select('value')
      .eq('key', key)
      .is('user_id', null)
      .maybeSingle();
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

    // Last fallback: any row with this key
    const { data: d3 } = await supabase
      .from('settings')
      .select('value')
      .eq('key', key)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (d3?.value !== undefined && d3?.value !== null) {
      localStorage.setItem(key, JSON.stringify(d3.value));
      return d3.value;
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
    const userId = await uid();
    // Delete all rows for this key owned by this user
    if (userId) {
      await supabase.from('settings').delete().eq('key', key).eq('user_id', userId);
    }
    // Also clean up null-user rows
    await supabase.from('settings').delete().eq('key', key).is('user_id', null);

    const row = { key, value, updated_at: new Date().toISOString() };
    if (userId) row.user_id = userId;
    const { error } = await supabase.from('settings').insert(row);
    if (error) throw error;
  } catch (e) {
    console.error('cloudSet failed:', key, e?.message || e);
  }
  localStorage.setItem(key, JSON.stringify(value));
}

export function localGet(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
