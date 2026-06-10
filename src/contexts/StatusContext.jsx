import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { loadStatuses, saveStatuses } from '../data/statuses';
import { supabase } from '../lib/supabase';

const SETTINGS_KEY = 'victoury_statuses';

async function loadFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .single();
    if (!error && data?.value && Array.isArray(data.value) && data.value.length > 0) {
      return data.value.map(s => ({ showInCommandes: true, showInColis: true, ...s }));
    }
  } catch {}
  return null;
}

async function saveToSupabase(list) {
  try {
    await supabase.from('settings').upsert({ key: SETTINGS_KEY, value: list, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  } catch {}
}

const StatusContext = createContext(null);

export function StatusProvider({ children }) {
  const [statuses, setStatuses] = useState(() => loadStatuses());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadFromSupabase().then(remote => {
      if (remote) { saveStatuses(remote); setStatuses(remote); }
      setReady(true);
    });

    /* Realtime — listen for changes on settings table */
    const channel = supabase
      .channel('settings-statuses')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'settings',
        filter: `key=eq.${SETTINGS_KEY}`,
      }, (payload) => {
        const val = payload.new?.value;
        if (Array.isArray(val) && val.length > 0) {
          const migrated = val.map(s => ({ showInCommandes: true, showInColis: true, ...s }));
          saveStatuses(migrated);
          setStatuses(migrated);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const updateStatuses = useCallback((list) => {
    saveStatuses(list);
    setStatuses(list);
    saveToSupabase(list);
  }, []);

  const getLive = useCallback((value) => {
    return statuses.find(s => s.value === value)
      || statuses.find(s => s.label.toLowerCase() === (value || '').toLowerCase())
      || { label: value || '—', color: '#6B7280' };
  }, [statuses]);

  return (
    <StatusContext.Provider value={{ statuses, updateStatuses, getLive, ready }}>
      {children}
    </StatusContext.Provider>
  );
}

export function useStatuses() {
  const ctx = useContext(StatusContext);
  if (!ctx) throw new Error('useStatuses must be used inside StatusProvider');
  return ctx;
}
