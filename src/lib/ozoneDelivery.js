import { cloudGet, cloudSet } from './cloudSettings';

/**
 * Récupère le livreur (agent de livraison) réel d'une commande depuis Ozon Express
 * — nom + téléphone extraits de l'historique de suivi — et le persiste dans
 * `ozone_dp_${order.id}` (localStorage + cloud) pour que le message WhatsApp
 * « info livreur » utilise le VRAI numéro du livreur, pas le numéro générique.
 *
 * @returns {Promise<{name:string, phone:string}|null>} l'info livreur, ou null.
 */
export async function fetchOzoneDeliveryPerson(order) {
  try {
    let cfg = {};
    try { cfg = JSON.parse(localStorage.getItem('auzone_config') || '{}'); } catch {}
    if (!cfg.customerId || !cfg.apiKey) {
      try {
        const remote = await cloudGet('auzone_config');
        if (remote?.customerId && remote?.apiKey) {
          cfg = remote;
          localStorage.setItem('auzone_config', JSON.stringify(remote));
        }
      } catch {}
    }
    if (!cfg.customerId || !cfg.apiKey) return null;

    const base = `https://api.ozonexpress.ma/customers/${cfg.customerId}/${cfg.apiKey}`;
    const tns = [...new Set([order.ozoneTracking, order.trackingNumber, order.id].filter(Boolean))];

    for (const tn of tns) {
      try {
        const body = new FormData();
        body.append('tracking-number', tn);
        const abort = new AbortController();
        const timeout = setTimeout(() => abort.abort(), 10000);
        const res = await fetch(`${base}/tracking`, { method: 'POST', body, signal: abort.signal });
        clearTimeout(timeout);
        if (!res.ok) continue;
        const json = await res.json();
        const track = json['TRACKING'] || json;
        const histRaw = track['HISTORY'] || track['PARCEL-HISTORY'] || track['history'] || {};
        const histList = Array.isArray(histRaw) ? histRaw : Object.values(histRaw);
        if (!histList.length) continue;

        let name = '';
        let phone = '';
        for (const h of histList) {
          const raw = h['COMMENT'] || '';
          const c = raw.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
            .replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
          // Téléphone du livreur (fixe ou mobile marocain).
          const phoneM = c.match(/T[ée]l[ée]phone\s*:?\s*(0[0-9]{9})/i) || c.match(/(0[5-7][0-9]{8})/);
          if (phoneM) phone = phoneM[1].trim();
          const nameM = c.match(/Livreur\s*:?\s*([A-Z][A-Za-zÀ-ÿ]+(?:\s+[A-Z][A-Za-zÀ-ÿ]+)*)/);
          if (nameM) name = nameM[1].trim();
        }

        if (name || phone) {
          const dp = { name, phone };
          try {
            localStorage.setItem(`ozone_dp_${order.id}`, JSON.stringify(dp));
            cloudSet(`ozone_dp_${order.id}`, dp);
          } catch {}
          return dp;
        }
      } catch {}
    }
    return null;
  } catch {
    return null;
  }
}
