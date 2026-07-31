import React from 'react';
import { X, Phone, MessageCircle } from 'lucide-react';

export default function ContactModal({ phone, onClose }) {
  const clean = (phone || '').replace(/\s+/g, '');

  function callPhone() {
    window.location.href = `tel:${clean}`;
    onClose();
  }

  function openWhatsApp() {
    // Numéro au format international (chiffres uniquement, 212 sans le 0).
    let d = (phone || '').replace(/\D/g, '');
    if (d.startsWith('212')) { /* déjà international */ }
    else if (d.startsWith('0')) d = '212' + d.slice(1);
    else if (d.length === 9) d = '212' + d; // 6/7xxxxxxx sans le 0
    // wa.me : lien universel qui ouvre la bonne discussion sur WhatsApp ET
    // WhatsApp Business, Android comme iOS (contrairement à l'intent w4b figé).
    window.open(`https://wa.me/${d}`, '_blank', 'noopener');
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
