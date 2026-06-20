import React from 'react';
import { X, Phone, MessageCircle } from 'lucide-react';

export default function ContactModal({ phone, onClose }) {
  const clean = (phone || '').replace(/\s+/g, '');

  function callPhone() {
    window.location.href = `tel:${clean}`;
    onClose();
  }

  function openWhatsApp() {
    const num = clean.startsWith('+') ? clean.slice(1) : clean.startsWith('0') ? '212' + clean.slice(1) : clean;
    window.open(`https://api.whatsapp.com/send?phone=${num}`, '_blank');
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-72 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 text-base">Contacter</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400">
            <X size={16} />
          </button>
        </div>

        <div className="flex gap-3 mb-4">
          <button
            onClick={callPhone}
            className="flex-1 flex flex-col items-center gap-2 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition-colors"
          >
            <Phone size={22} />
            <span className="text-sm">Appeler</span>
          </button>
          <button
            onClick={openWhatsApp}
            className="flex-1 flex flex-col items-center gap-2 py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold transition-colors"
          >
            <MessageCircle size={22} />
            <span className="text-sm">WhatsApp</span>
          </button>
        </div>

        <p className="text-center text-sm text-gray-500 font-mono">{phone}</p>
      </div>
    </div>
  );
}
