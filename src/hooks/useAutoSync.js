import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { cloudSet } from '../lib/cloudSettings';

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
  'phone_colors',
  'victoury_wa_templates',
  'gs_import',
];

const MERGE_KEYS = new Set([
  'victoury_sent_livreur',
  'victoury_recu_ids',
  'victoury_manual_facture',
  'deleted_order_ids',
]);

const SYNC_INTERVAL = 30_000;

function getDynamicKeys() {
  const keys = [];
  try {
    const livreurs = JSON.parse(localStorage.getItem('livreurs') || '[]');
    for (const l of livreurs) {
      if (l.id) keys.push(`frais_${l.id}`);
      if (l.id) keys.push(`api_config_${l.id}`);
    }
  } catch {}
  return keys;
}

export default function useAutoSync(session) {
  const lastSyncRef = useRef(0);

  useEffect(() => {
    if (!session) return;

    const userId = session.user?.id || null;

    async function pullFromCloud() {
      const now = Date.now();
      if (now - lastSyncRef.current < 10_000) return;
      lastSyncRef.current = now;

      try {
        const allKeys = [...SYNC_KEYS, ...getDynamicKeys()];

        let query = supabase
          .from('settings')
          .select('key, value, updated_at')
          .in('key', allKeys);

        if (userId) {
          query = query.or(`user_id.eq.${userId},user_id.is.null`);
        } else {
          query = query.is('user_id', null);
        }

        const { data, error } = await query;
        if (error || !data) return;

        // Prefer user-scoped rows over null rows
        const byKey = new Map();
        for (const row of data) {
          const existing = byKey.get(row.key);
          if (!existing || (row.user_id && !existing.user_id)) {
            byKey.set(row.key, row);
          }
        }

        for (const [, row] of byKey) {
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
      } catch (e) { console.warn('[sync] pull failed:', e?.message); }
    }

    async function pushToCloud() {
      try {
        const allKeys = [...SYNC_KEYS, ...getDynamicKeys()];
        for (const key of allKeys) {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          try {
            await cloudSet(key, JSON.parse(raw));
          } catch {}
        }
      } catch (e) { console.warn('[sync] push failed:', e?.message); }
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
