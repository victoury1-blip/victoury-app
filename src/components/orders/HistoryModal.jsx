import React, { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import StatusBadge from './StatusBadge';

export default function HistoryModal({ order, onClose }) {
  const [hist, setHist] = useState([]);
  React.useEffect(() => {
    const local = JSON.parse(localStorage.getItem(`order_history_${order.id}`) || '[]');
    if (local.length) setHist(local);
    supabase.from('order_history').select('*').eq('order_id', order.id).order('timestamp', { ascending: true })
      .then(({ data }) => {
        if (data?.length) {
          const mapped = data.map(r => ({ timestamp: r.timestamp, status: r.status, user: r.user_name }));
          setHist(mapped);
          localStorage.setItem(`order_history_${order.id}`, JSON.stringify(mapped));
        }
      });
  }, [order.id]);
  const displayHist = hist.length > 0 ? hist : [
    { timestamp: order.dateAdded || '—', status: order.status, user: 'Création' }
  ];
  // Trie du plus récent au plus ancien à partir de la vraie date (jj/mm/aaaa hh:mm),
  // car le tri texte mélange juillet (06/07) avec juin (22/06).
  const parseTs = (s) => {
    const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})[ T]*(\d{1,2})?:?(\d{1,2})?/);
    if (!m) return 0;
    return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)).getTime();
  };
  const sortedHist = [...displayHist].sort((a, b) => parseTs(b.timestamp) - parseTs(a.timestamp));
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
      <div className="bg-white rounded-t-xl sm:rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">Historique du commande</h2>
            <p className="text-xs text-gray-400 mt-0.5">{order.id}</p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="p-1.5 rounded hover:bg-gray-100"><X size={15} className="text-gray-400" /></button>
        </div>
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-800">{order.recipient.name} // {order.recipient.city} ({order.recipient.phone})</p>
          <p className="text-xs text-gray-500 mt-0.5">{order.recipient.address}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-2 text-left text-xs font-semibold text-gray-500">Date mise à jour</th>
                <th className="px-6 py-2 text-left text-xs font-semibold text-gray-500">État</th>
                <th className="px-6 py-2 text-left text-xs font-semibold text-gray-500">Utilisateur</th>
              </tr>
            </thead>
            <tbody>
              {displayHist.length === 0 && (
                <tr><td colSpan={3} className="px-6 py-6 text-center text-gray-400 text-xs">Aucun historique disponible</td></tr>
              )}
              {sortedHist.map((h, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-2.5 text-xs text-gray-700">{h.timestamp}</td>
                  <td className="px-6 py-2.5">
                    {h.note ? (
                      <span className="text-xs text-blue-700 font-medium">{h.note}</span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {h.fromStatus && <><StatusBadge status={h.fromStatus} /><span className="text-gray-400 text-xs">→</span></>}
                        <StatusBadge status={h.status} />
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-2.5 text-xs text-gray-700 font-medium">{h.user}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Fermer</button>
        </div>
      </div>
    </div>
  );
}
