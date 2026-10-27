/* Statut Ozon d'un colis — exactement la même lecture que la fenêtre du camion
 * (DeliveryStatusModal) : suivi + infos colis, et le colis n'est retenu que si
 * son téléphone est bien celui du client (sinon le code désigne le colis de
 * quelqu'un d'autre, et son « Livré » n'a rien à voir avec cette commande). */
import { normalizePhone, samePhone } from './phoneUtils';

async function postCode(url, tn, signal) {
  const body = new FormData();
  body.append('tracking-number', tn);
  const res = await fetch(url, { method: 'POST', body, signal });
  return res.ok ? res.json() : null;
}

/** Statut actuel chez Ozon, ou null (introuvable, autre client, erreur). */
export async function statutOzonColis(order, base) {
  const codes = [...new Set([order.trackingNumber, order.ozoneTracking, order.id].filter(Boolean))];
  for (const tn of codes) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 10000);
    try {
      const [trackJson, infoJson] = await Promise.all([
        postCode(`${base}/tracking`, tn, ac.signal),
        postCode(`${base}/parcel-info`, tn, ac.signal),
      ]);
      const track = trackJson ? (trackJson.TRACKING || trackJson) : {};
      const parcel = infoJson ? (infoJson['PARCEL-INFO'] || infoJson) : {};
      if (String(track.RESULT || '').toUpperCase() === 'ERROR' && String(parcel.RESULT || '').toUpperCase() === 'ERROR') continue;
      const infos = parcel.INFOS || parcel;
      const last = track.LAST_TRACKING || track['LAST-TRACKING'] || {};
      const statut = last.STATUT || last.STATUS || infos['PARCEL-STATUS'] || infos.STATUS || track.STATUT || '';
      if (!statut) continue;
      const ozPhone = normalizePhone(infos.PHONE || infos['RECIPIENT-PHONE']);
      if (ozPhone && !samePhone(ozPhone, normalizePhone(order.recipient?.phone))) continue;
      return statut;
    } catch {
      /* code suivant */
    } finally {
      clearTimeout(t);
    }
  }
  return null;
}
