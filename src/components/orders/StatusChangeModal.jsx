import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useStatuses } from '../../contexts/StatusContext';

export default function StatusChangeModal({ order, onClose, onSave }) {
  const { statuses } = useStatuses();
  const sorted = [...statuses].filter(s => s.showInCommandes !== false).sort((a, b) => a.order - b.order);
  const [newStatus, setNewStatus] = useState(order.status);
  const [note, setNote] = useState('');
  const [reportDate, setReportDate] = useState(order.reportDate || '');
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" onKeyDown={e => { if (e.key === 'Escape') onClose(); }} onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-800">Modifier le statut de la commande</h3>
          <button type="button" onClick={onClose} aria-label="Fermer" className="p-1 hover:bg-gray-100 rounded"><X size={16} className="text-gray-400" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nouveau statut</label>
            <select
              value={newStatus}
              onChange={e => setNewStatus(e.target.value)}
              className="w-full px-4 py-3 bg-white text-gray-800 rounded-lg text-sm font-semibold border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              {sorted.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          {newStatus === 'reporter' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date de rappel</label>
              <input
                type="date"
                value={reportDate}
                onChange={e => setReportDate(e.target.value)}
                className="w-full px-4 py-3 bg-white text-gray-800 rounded-lg text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Note interne</label>
            <textarea
              value={note} onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
              placeholder="Ajouter une note interne..."
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button type="button" onClick={onClose} className="px-5 py-3 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-200">Annuler</button>
          <button
            type="button"
            onClick={() => onSave(order.id, newStatus, note, newStatus === 'reporter' ? reportDate : null)}
            className="px-5 py-3 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 active:bg-blue-800"
          >Enregistrer</button>
        </div>
      </div>
    </div>
  );
}
