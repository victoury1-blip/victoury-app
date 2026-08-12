import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { cloudSet } from '../lib/cloudSettings';

const SYNC_KEYS = [
  'victoury_products',
  'victoury_statuses',
  'victoury_factures',
  'victoury_fct_counter',
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
  'victoury_saved_filters',
  'chic_config',
  'chic_hidden_orders',
  'chic_hidden_ids',
];

// Clés fusionnées par UNION (croissante). Attention : une union ne peut jamais
// retirer un élément — n'y mettre que des listes purement additives.
// `victoury_recu_ids` et `victoury_manual_facture` en sont EXCLUES : décocher
// « Reçu » / « Facturé » doit tenir après la synchro (sinon l'union ré-ajoute
// l'id retiré) ; la colonne orders.recu et les factures sont la source de vérité.
const MERGE_KEYS = new Set([
  'victoury_sent_livreur',
  'deleted_order_ids',
  // Masquage des commandes/produits Chic : additif, doit tenir sur tous les appareils.
  'chic_hidden_orders',
  'chic_hidden_ids',
]);

/* Les réglages synchronisés contiennent des blobs volumineux (produits,
   factures). Les relire toutes les 30 s représentait un transfert permanent
   pour des données qui changent rarement — c'est l'une des causes du quota de
   bande passante épuisé. Un rafraîchissement a lieu de toute façon à chaque
   retour au premier plan (visibilitychange). */
const SYNC_INTERVAL = 5 * 60_000;

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
  // Dernière valeur connue du cloud par clé : on ne repousse que ce que CE
  // device a réellement modifié depuis, sinon un appareil avec des données
  // périmées écrase les factures/produits créés ailleurs.
  const lastPulledRef = useRef({});

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
            lastPulledRef.current[row.key] = remoteJson;
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
          // Inchangé depuis le dernier pull -> rien à pousser.
          if (lastPulledRef.current[key] === raw) continue;
          try {
            await cloudSet(key, JSON.parse(raw));
            lastPulledRef.current[key] = raw;
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

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [session]);
}
