import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { loadStatuses, saveStatuses } from '../data/statuses';
import { cloudGet, cloudSet } from '../lib/cloudSettings';
import { supabase } from '../lib/supabase';

const SETTINGS_KEY = 'victoury_statuses';

async function loadFromSupabase() {
  try {
    const remote = await cloudGet(SETTINGS_KEY);
    if (Array.isArray(remote) && remote.length > 0) {
      return remote.map(s => ({ showInCommandes: true, showInColis: true, ...s }));
    }
  } catch {}
  return null;
}

async function saveToSupabase(list) {
  try {
    await cloudSet(SETTINGS_KEY, list);
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
