/* Envoi automatique des conversions à Meta.
 *
 * Une commande ne change d'issue qu'une fois : chaque évènement ne doit partir
 * qu'une seule fois, sinon la même vente est comptée plusieurs fois et fausse
 * autant l'apprentissage que le retour sur dépense affiché.
 *
 * Ce qui est déjà parti est donc mémorisé, localement ET dans le cloud : sans
 * cela, ouvrir l'application sur un second appareil renverrait tout l'historique.
 */
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { cloudGet, cloudSet } from '../lib/cloudSettings';
import { getMetaConfig, loadMetaConfigRemote, buildEvent, eventForStatus, eventId, sendEvents, orderTimestamp, MAX_AGE_MS } from '../lib/metaCapi';
import { logAlert } from '../lib/errorLog';

const SENT_KEY = 'meta_capi_sent';

function readSent() {
  try { return new Set(JSON.parse(localStorage.getItem(SENT_KEY) || '[]')); } catch { return new Set(); }
}
function writeSent(set) {
  // Borné : la liste ne doit pas grossir sans fin dans le stockage local.
  const arr = [...set].slice(-5000);
  try { localStorage.setItem(SENT_KEY, JSON.stringify(arr)); } catch { /* quota */ }
  cloudSet(SENT_KEY, arr);
}

export default function useMetaCapi(orders) {
  const sentRef = useRef(null);
  const busyRef = useRef(false);
  const [cfgReady, setCfgReady] = useState(false);

  /* Le réglage vient du compte, pas de l'appareil : sur un téléphone où rien
     n'a jamais été saisi, il n'existe qu'après cette lecture. */
  useEffect(() => {
    loadMetaConfigRemote().catch(() => { /* le local suffit */ }).finally(() => setCfgReady(true));
  }, []);

  // La mémoire du cloud fait foi au démarrage : elle porte ce qu'ont déjà
  // envoyé les autres appareils.
  useEffect(() => {
    sentRef.current = readSent();
    cloudGet(SENT_KEY).then(remote => {
      if (!Array.isArray(remote)) return;
      const merged = new Set([...(sentRef.current || []), ...remote]);
      sentRef.current = merged;
      try { localStorage.setItem(SENT_KEY, JSON.stringify([...merged].slice(-5000))); } catch { /* quota */ }
    }).catch(() => { /* le local suffit */ });
  }, []);

  useEffect(() => {
    if (!cfgReady) return;
    const cfg = getMetaConfig();
    if (!cfg.enabled || !cfg.pixelId || !cfg.token) return;
    if (!sentRef.current || busyRef.current || !orders?.length) return;

    const now = Date.now();
    const pending = orders.filter(o => {
      const spec = eventForStatus(o?.status);
      if (!spec) return false;
      if (sentRef.current.has(eventId(o, spec.name))) return false;
      const t = orderTimestamp(o);
      return Number.isFinite(t) && now - t <= MAX_AGE_MS;
    });
    if (!pending.length) return;

    busyRef.current = true;
    (async () => {
      try {
        // Par paquets : un envoi géant échouerait en entier au moindre refus.
        const batch = pending.slice(0, 50);
        const events = (await Promise.all(batch.map(o => buildEvent(o, cfg)))).filter(Boolean);
        if (!events.length) return;
        const { data: { session } } = await supabase.auth.getSession();
        const r = await sendEvents(events, cfg, session?.access_token);
        if (!r.ok) { logAlert('Meta CAPI', r.error || 'Envoi refusé'); return; }
        // Marqué APRÈS confirmation seulement : marquer avant perdrait
        // définitivement les conversions d'un envoi qui a échoué.
        const next = new Set(sentRef.current);
        for (const o of batch) {
          const spec = eventForStatus(o.status);
          if (spec) next.add(eventId(o, spec.name));
        }
        sentRef.current = next;
        writeSent(next);
      } catch (e) {
        logAlert('Meta CAPI', e?.message || 'Envoi impossible');
      } finally {
        busyRef.current = false;
      }
    })();
  }, [orders, cfgReady]);
}
