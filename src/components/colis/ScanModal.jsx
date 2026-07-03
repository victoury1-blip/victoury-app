import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ScanLine } from 'lucide-react';
import { findOrderByCode } from '../../lib/scanUtils';
import useBarcodeScanner from '../../hooks/useBarcodeScanner';

export default function ScanModal({ orders, onFound, onClose }) {
  const [msg, setMsg] = useState(null);
  const [manualInput, setManualInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef(null);

  const processCode = useCallback((code) => {
    const order = findOrderByCode(orders, code);
    if (!order) { setMsg({ text: `Non trouvé: ${String(code || '').trim()}`, error: true }); return; }
    try { new (window.AudioContext || window.webkitAudioContext)().createOscillator(); } catch {}
    onFound(order.id);
    setMsg({ text: `✓ ${order.recipient?.name || order.id}`, error: false });
  }, [orders, onFound]);

  const processCodeRef = useRef(processCode);
  useEffect(() => { processCodeRef.current = processCode; }, [processCode]);

  useBarcodeScanner(scanning, 'colis-scanner-video', 
    (code) => processCodeRef.current(code),
    (reason) => { setMsg({ text: reason, error: true }); setScanning(false); }
  );

  function stopScanner() {
    setScanning(false);
  }

  function close() { stopScanner(); onClose(); }

  function handleManualSubmit(e) {
    e.preventDefault();
    processCode(manualInput);
    setManualInput('');
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4" onClick={close}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 flex items-center gap-2"><ScanLine size={18} className="text-blue-600" /> Scanner un colis</h2>
          <button onClick={close} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={15} className="text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          {!scanning ? (
            <button
              onClick={() => setScanning(true)}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <ScanLine size={18} /> Scanner QR Code
            </button>
          ) : (
            <div className="rounded-xl overflow-hidden">
              <div className="relative bg-black overflow-hidden" style={{ height: 240 }}>
                <video id="colis-scanner-video" className="w-full h-full object-cover" playsInline muted />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative w-40 h-40">
                    <div className="absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 border-white rounded-tl" />
                    <div className="absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 border-white rounded-tr" />
                    <div className="absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 border-white rounded-bl" />
                    <div className="absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 border-white rounded-br" />
                  </div>
                </div>
                <p className="absolute bottom-2 left-0 right-0 text-center text-white text-xs opacity-70 pointer-events-none">Pointez vers le code-barres</p>
              </div>
              <button
                onClick={stopScanner}
                className="w-full py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition"
              >
                Arrêter la caméra
              </button>
            </div>
          )}
          {msg && <div className={`px-4 py-2.5 rounded-lg text-sm font-medium text-center ${msg.error ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>{msg.text}</div>}
          {/* Manual fallback */}
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-400 text-center mb-2">Ou saisissez le numéro manuellement</p>
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                ref={inputRef}
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                placeholder="Ex: VICT0001"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
              <button type="submit" disabled={!manualInput.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-40">
                OK
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

