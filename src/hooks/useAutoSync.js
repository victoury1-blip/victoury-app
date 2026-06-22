import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { cloudGet } from '../lib/cloudSettings';

const SYNC_KEYS = [
  'victoury_products',
  'victoury_statuses',
  'victoury_factures',
  'victoury_facture_ctr',
  'livreurs',
  'victoury_recu_ids',
  'victoury_manual_facture',
  'ad_transfers',
  'moderators',
  'notification_sound',
  'victoury_app_config',
  'victoury_shop_config',
  'system_timezone',
  'user_profiles',
  'auzone_config',
  'woo_config',
  'push_notifications',
  'victoury_profile',
  'deleted_order_ids',
  'victoury_sent_livreur',
  'vict_counter',
  'frais_1',
];

const MERGE_KEYS = new Set([
  'victoury_sent_livreur',
  'victoury_recu_ids',
  'victoury_manual_facture',
  'deleted_order_ids',
]);

const SYNC_INTERVAL = 30_000;

export default function useAutoSync(session) {
  const lastSyncRef = useRef(0);

  useEffect(() => {
    if (!session) return;

    async function pullFromCloud() {
      const now = Date.now();
      if (now - lastSyncRef.current < 10_000) return;
      lastSyncRef.current = now;

      try {
        const { data, error } = await supabase
          .from('settings')
          .select('key, value, updated_at')
          .in('key', SYNC_KEYS)
          .is('user_id', null);

        if (error || !data) return;

        for (const row of data) {
          if (row.value === null || row.value === undefined) continue;
          if (MERGE_KEYS.has(row.key) && Array.isArray(row.value)) {
            try {
              const local = JSON.parse(localStorage.getItem(row.key) || '[]');
              const merged = [...new Set([...local, ...row.value])];
              localStorage.setItem(row.key, JSON.stringify(merged));
            } catch {
              localStorage.setItem(row.key, JSON.stringify(row.value));
            }
          } else {
            const localRaw = localStorage.getItem(row.key);
            const remoteJson = JSON.stringify(row.value);
            if (localRaw !== remoteJson) {
              localStorage.setItem(row.key, remoteJson);
            }
          }
        }
      } catch {}
    }

    async function pushToCloud() {
      try {
        const rows = [];
        for (const key of SYNC_KEYS) {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          try {
            rows.push({
              key,
              value: JSON.parse(raw),
              user_id: null,
              updated_at: new Date().toISOString(),
            });
          } catch {}
        }
        if (rows.length) {
          await supabase.from('settings').upsert(rows, { onConflict: 'key' });
        }
      } catch {}
    }

    pullFromCloud().then(() => pushToCloud());

    const interval = setInterval(pullFromCloud, SYNC_INTERVAL);

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        pullFromCloud();
      } else {
        pushToCloud();
      }
    }

    function handleBeforeUnload() {
      pushToCloud();
    }

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [session]);
}
