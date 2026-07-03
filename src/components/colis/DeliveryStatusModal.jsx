import React, { useState, useEffect } from 'react';
import { X, Check, Phone, Truck } from 'lucide-react';
import { cloudGet, cloudSet } from '../../lib/cloudSettings';

export const DELIVERY_STATUSES = [
  { value: 'att_ramassage', label: 'En Attente Ramassage', color: '#f59e0b' },
  { value: 'expedier',      label: 'Expédié',              color: '#3b82f6' },
  { value: 'recu_livreur',  label: 'Reçu Par Livreur',     color: '#6366f1' },
  { value: 'livre',         label: 'Livré',                color: '#16a34a' },
  { value: 'change',        label: 'Échange',              color: '#0891b2' },
  { value: 'refuse',        label: 'Refusé',               color: '#ef4444' },
  { value: 'pas_rep_lv',    label: 'Pas Répondu (Liv.)',   color: '#9ca3af' },
  { value: 'pret_retour',   label: 'Prêt Retour',          color: '#7c3aed' },
  { value: 'dem_suivi',     label: 'Demande de Suivi',     color: '#d97706' },
  { value: 'injoignable',   label: 'Injoignable',          color: '#dc2626' },
  { value: 'manque_stock',  label: 'Manque de Stock',      color: '#b45309' },
];

export default function DeliveryStatusModal({ order, onClose, onSave }) {
  const ozTn = order.ozoneTracking || order.trackingNumber;
  const [status, setStatus] = useState(order.status);
  const [note, setNote] = useState('');
  const [ozoneState, setOzoneState] = useState('idle');
  const [ozoneData, setOzoneData] = useState(null);
  const [manualTn, setManualTn] = useState('');
  const current = DELIVERY_STATUSES.find(s => s.value === status);
  const localStatus = DELIVERY_STATUSES.find(s => s.value === order.status);

  useEffect(() => { fetchOzone(); }, []);

  async function fetchOzone(customTn) {
    setOzoneState('loading');
    try {
      let cfg = JSON.parse(localStorage.getItem('auzone_config') || '{}');
      if (!cfg.customerId || !cfg.apiKey) {
        try {
          const remote = await cloudGet('auzone_config');
          if (remote?.customerId && remote?.apiKey) {
            cfg = remote;
            localStorage.setItem('auzone_config', JSON.stringify(remote));
          }
        } catch {}
      }
      if (!cfg.customerId || !cfg.apiKey) { setOzoneState('no_config'); return; }
      const base = `https://api.ozonexpress.ma/customers/${cfg.customerId}/${cfg.apiKey}`;
      const tns = customTn
        ? [customTn]
        : [...new Set([ozTn, order.trackingNumber, order.id].filter(Boolean))];

      for (const tn of tns) {
        try {
          const body = new FormData();
          body.append('tracking-number', tn);
          const ozAbort = new AbortController();
          const ozTimeout = setTimeout(() => ozAbort.abort(), 10000);
          const [trackRes, infoRes] = await Promise.all([
            fetch(`${base}/tracking`, { method: 'POST', body, signal: ozAbort.signal }),
            fetch(`${base}/parcel-info`, { method: 'POST', body: (() => { const f = new FormData(); f.append('tracking-number', tn); return f; })(), signal: ozAbort.signal }),
          ]);
          clearTimeout(ozTimeout);
          const trackJson = trackRes.ok ? await trackRes.json() : null;
          const infoJson = infoRes.ok ? await infoRes.json() : null;
          const track = trackJson ? (trackJson['TRACKING'] || trackJson) : {};
          const parcel = infoJson ? (infoJson['PARCEL-INFO'] || infoJson) : {};
          if ((track['RESULT'] || '').toUpperCase() === 'ERROR' && (parcel['RESULT'] || '').toUpperCase() === 'ERROR') continue;

          const pick = (...keys) => {
            for (const src of [parcel, track]) {
              for (const k of keys) { if (src[k]) return src[k]; }
            }
            return '';
          };
          const parcelInfos = parcel['INFOS'] || parcel;
          const lastTrack = track['LAST_TRACKING'] || track['LAST-TRACKING'] || {};
          const ozStatus = lastTrack['STATUT'] || lastTrack['STATUS'] || parcelInfos['PARCEL-STATUS'] || parcelInfos['STATUS'] || track['STATUT'] || '';
          const histRaw = track['HISTORY'] || track['PARCEL-HISTORY'] || track['history'] || {};
          const histList = Array.isArray(histRaw) ? histRaw : Object.values(histRaw);

          if (!ozStatus && histList.length === 0) continue;

          const realTn = parcelInfos['TRACKING-NUMBER'] || track['TRACKING-NUMBER'] || tn;
          if (realTn && realTn !== order.ozoneTracking) {
            onSave(order.id, order.status, '', realTn);
          }

          let deliveryPerson = '';
          let deliveryPhone = '';
          for (const h of histList) {
            const raw = h['COMMENT'] || '';
            const c = raw.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
            const phoneM = c.match(/T[ée]l[ée]phone\s*:?\s*(0[0-9]{9})/i);
            if (phoneM) deliveryPhone = phoneM[1].trim();
            const nameM = c.match(/Livreur\s*:?\s*([A-Z][A-Za-zÀ-ÿ]+(?:\s+[A-Z][A-Za-zÀ-ÿ]+)*)/);
            if (nameM) deliveryPerson = nameM[1].trim();
          }

          setOzoneData({
            tracking: realTn,
            status: ozStatus,
            receiver: parcelInfos['RECEIVER'] || parcelInfos['RECIPIENT-NAME'] || '',
            phone: parcelInfos['PHONE'] || parcelInfos['RECIPIENT-PHONE'] || '',
            city: parcelInfos['CITY_NAME'] || parcelInfos['CITY'] || '',
            cod: parcelInfos['PRICE'] || parcelInfos['COD'] || '',
            history: histList,
            deliveryPerson,
            deliveryPhone,
          });
          if (deliveryPerson || deliveryPhone) {
            try { localStorage.setItem(`ozone_dp_${order.id}`, JSON.stringify({ name: deliveryPerson, phone: deliveryPhone })); cloudSet(`ozone_dp_${order.id}`, { name: deliveryPerson, phone: deliveryPhone }); } catch {}
          }
          if (ozStatus) onSave(order.id, order.status, '', realTn, ozStatus);
          setOzoneState('ok');
          return;
        } catch {}
      }
      setOzoneState('not_found');
    } catch { setOzoneState('error'); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
      <div className="bg-white rounded-t-xl sm:rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-100"><Truck size={15} className="text-amber-600" /></span>
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Livraison — {order.id}</h3>
              <p className="text-xs text-gray-400">{order.recipient?.name} — {order.recipient?.city}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="p-1 hover:bg-gray-100 rounded"><X size={15} className="text-gray-400" /></button>
        </div>

        <div className="p-4 max-h-[70vh] overflow-y-auto space-y-3">
          {/* Local status - always visible, instant */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1.5">Statut actuel</p>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: localStatus?.color || '#f59e0b' }} />
              <span className="text-sm font-bold" style={{ color: localStatus?.color || '#f59e0b' }}>{localStatus?.label || order.status}</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">{order.dateUpdated || order.dateAdded}</p>
          </div>

          {/* Ozone section */}
          <div className="border border-amber-200 rounded-lg overflow-hidden">
            <div className="bg-amber-50 px-3 py-2 flex items-center justify-between">
              <span className="text-xs font-bold text-amber-700">Ozone Express</span>
              {ozoneState === 'idle' && (
                <div className="flex items-center gap-1 text-xs text-amber-600">
                  <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {ozoneState === 'loading' && (
                <div className="flex items-center gap-1 text-xs text-amber-600">
                  <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  Chargement...
                </div>
              )}
              {ozoneState === 'ok' && (
                <button onClick={() => fetchOzone()} className="text-[10px] text-amber-600 hover:underline">Actualiser</button>
              )}
            </div>

            <div className="px-3 py-2">
              {ozoneState === 'idle' && (
                <p className="text-xs text-gray-400 text-center py-2">Chargement...</p>
              )}

              {ozoneState === 'no_config' && (
                <p className="text-xs text-amber-600 text-center py-2">API non configurée. Allez dans Réglages → Ozon Express.</p>
              )}

              {(ozoneState === 'error' || ozoneState === 'not_found') && (
                <div className="py-2">
                  <p className="text-xs text-red-500 mb-2 text-center">Introuvable avec: {[ozTn, order.trackingNumber, order.id].filter(Boolean).join(', ')}</p>
                  <div className="flex gap-2">
                    <input
                      value={manualTn}
                      onChange={e => setManualTn(e.target.value)}
                      placeholder="Entrez le N° Ozone..."
                      className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-300"
                      onKeyDown={e => { if (e.key === 'Enter' && manualTn.trim()) fetchOzone(manualTn.trim()); }}
                    />
                    <button
                      onClick={() => manualTn.trim() && fetchOzone(manualTn.trim())}
                      disabled={!manualTn.trim()}
                      className="px-3 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-lg hover:bg-amber-600 disabled:opacity-40 transition"
                    >
                      OK
                    </button>
                  </div>
                </div>
              )}

              {ozoneState === 'ok' && ozoneData && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    <span className="text-sm font-bold text-green-700">{ozoneData.status}</span>
                  </div>
                  {ozoneData.tracking && <p className="text-[10px] text-gray-500">N° suivi: <span className="font-mono text-amber-700">{ozoneData.tracking}</span></p>}
                  {ozoneData.cod && <p className="text-[10px] text-gray-500">COD: <span className="font-semibold text-gray-700">{ozoneData.cod} DH</span></p>}
                  {ozoneData.history.length > 0 && (
                    <div className="mt-2 border-t border-gray-100 pt-2">
                      <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Historique</p>
                      <div className="relative pl-3 space-y-1.5">
                        <div className="absolute left-1 top-0 bottom-0 w-px bg-gray-200" />
                        {ozoneData.history.map((h, i) => (
                          <div key={i} className="relative">
                            <span className="absolute -left-[7px] w-2 h-2 rounded-full border border-white"
                              style={{ backgroundColor: i === 0 ? '#f59e0b' : '#d1d5db' }} />
                            <p className="text-[11px] font-semibold text-gray-700 pl-1">{h['STATUT'] || h['STATUS'] || h['status'] || ''}</p>
                            {(h['TIME_STR'] || h['DATE'] || h['date']) && <p className="text-[10px] text-gray-400 pl-1">{h['TIME_STR'] || h['DATE'] || h['date']}</p>}
                            {h['COMMENT'] && <p className="text-[10px] text-gray-400 pl-1">{h['COMMENT']}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Manual status change */}
          <details className="border border-gray-200 rounded-lg overflow-hidden">
            <summary className="bg-gray-50 px-3 py-2 text-xs font-bold text-gray-600 cursor-pointer hover:bg-gray-100 select-none">
              Changer le statut manuellement
            </summary>
            <div className="p-3 space-y-2">
              <div className="grid grid-cols-1 gap-1.5 max-h-44 overflow-y-auto pr-1">
                {DELIVERY_STATUSES.map(s => (
                  <button key={s.value} onClick={() => setStatus(s.value)}
                    className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs text-left transition-all border ${
                      status === s.value ? 'text-white font-semibold border-transparent' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                    style={status === s.value ? { backgroundColor: s.color, borderColor: s.color } : {}}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                    {s.label}
                    {status === s.value && <Check size={12} className="ml-auto" />}
                  </button>
                ))}
              </div>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Note interne (optionnel)..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none" />
              <div className="flex justify-end gap-2">
                <button onClick={onClose} className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-50">Annuler</button>
                <button onClick={() => onSave(order.id, status, note)}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition"
                  style={{ backgroundColor: current?.color || '#f59e0b' }}>
                  Enregistrer
                </button>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

/* ── Bulk Action Bar for Colis ── */
