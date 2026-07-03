import React from 'react';
import { X } from 'lucide-react';
import { useStatuses } from '../../contexts/StatusContext';

export default function CustomerHistoryModal({ phone, orders, onClose }) {
  const { getLive } = useStatuses();
  const customerName = orders[0]?.recipient?.name || 'Client';
  const sorted = [...orders].sort((a, b) => (b.dateAdded || '').localeCompare(a.dateAdded || ''));
  const totalSpent = orders.reduce((sum, o) => sum + (parseFloat(o.price) || 0), 0);
  const livreCount = orders.filter(o => o.status === 'livré' || o.status === 'livre').length;
  const refuseCount = orders.filter(o => o.status === 'refusé' || o.status === 'refuse').length;
  const tauxLivraison = orders.length > 0 ? Math.round((livreCount / orders.length) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" onKeyDown={e => { if (e.key === 'Escape') onClose(); }} onClick={onClose}>
      <div className="bg-white rounded-t-xl sm:rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">{customerName}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{phone}</p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="p-1.5 rounded hover:bg-gray-100"><X size={15} className="text-gray-400" /></button>
        </div>
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div>
            <div className="text-lg font-bold text-gray-900">{orders.length}</div>
            <div className="text-xs text-gray-500">Commandes</div>
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900">{totalSpent.toFixed(0)} DH</div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
          <div>
            <div className="text-lg font-bold text-green-600">{livreCount} / <span className="text-red-500">{refuseCount}</span></div>
            <div className="text-xs text-gray-500">Livré / Refusé</div>
          </div>
          <div>
            <div className="text-lg font-bold text-blue-600">{tauxLivraison}%</div>
            <div className="text-xs text-gray-500">Taux livraison</div>
          </div>
        </div>
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-gray-100">
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">ID</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Date</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Statut</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Prix</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Produit</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400 text-xs">Aucune commande</td></tr>
              )}
              {sorted.map(o => {
                const live = getLive(o.status);
                const color = live.color || '#6B7280';
                return (
                  <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-xs font-mono font-bold text-orange-600">{o.id}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{o.dateAdded || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ backgroundColor: color, color: '#fff' }}>
                        {live.label || o.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-700 text-right font-medium">{o.price || '—'} DH</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600 max-w-[120px] truncate">{o.products?.[0]?.name || o.product?.name || '—'}</td>
                  </tr>
                );
              })}
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
