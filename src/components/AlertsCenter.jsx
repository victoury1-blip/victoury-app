import React, { useEffect, useState } from 'react';
import { Bell, X, AlertTriangle, Trash2, CheckCircle2 } from 'lucide-react';
import { getAlerts, clearAlerts, markAlertsSeen, getUnseenCount } from '../lib/errorLog';

function timeAgo(ts) {
  const d = (Date.now() - new Date(ts).getTime()) / 1000;
  if (d < 60) return "à l'instant";
  if (d < 3600) return `il y a ${Math.floor(d / 60)} min`;
  if (d < 86400) return `il y a ${Math.floor(d / 3600)} h`;
  return new Date(ts).toLocaleDateString('fr-MA');
}

export default function AlertsCenter() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState(getAlerts());
  const [unseen, setUnseen] = useState(getUnseenCount());

  useEffect(() => {
    const refresh = () => { setAlerts(getAlerts()); setUnseen(getUnseenCount()); };
    window.addEventListener('app-alert', refresh);
    return () => window.removeEventListener('app-alert', refresh);
  }, []);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) { markAlertsSeen(); setUnseen(0); }
  }

  return (
    <div className="relative">
      <button
        onClick={toggle}
        className="relative w-11 h-11 rounded-full bg-white border border-gray-200 shadow-sm hover:shadow flex items-center justify-center text-gray-600 transition"
        title="Centre d'alertes"
      >
        <Bell size={18} />
        {unseen > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{unseen}</span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-xl border border-gray-200 shadow-2xl z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="font-bold text-gray-800 text-sm flex items-center gap-1.5"><AlertTriangle size={15} className="text-amber-500" /> Centre d'alertes</span>
              <div className="flex items-center gap-2">
                {alerts.length > 0 && (
                  <button onClick={() => { clearAlerts(); setAlerts([]); }} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1"><Trash2 size={12} /> Tout effacer</button>
                )}
                <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-gray-100"><X size={14} className="text-gray-400" /></button>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="px-4 py-10 text-center text-gray-400 text-sm flex flex-col items-center gap-2">
                  <CheckCircle2 size={28} className="text-green-400" />
                  Aucune alerte — tout va bien 👍
                </div>
              ) : alerts.map(a => (
                <div key={a.id} className="px-4 py-3 border-b border-gray-50 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">{a.source}</span>
                    <span className="text-[10px] text-gray-400">{timeAgo(a.ts)}</span>
                  </div>
                  <p className="text-xs text-gray-700 mt-1 leading-relaxed">{a.message}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
