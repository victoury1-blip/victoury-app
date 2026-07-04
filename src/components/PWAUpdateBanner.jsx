import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

export default function PWAUpdateBanner() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [reg, setReg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.ready.then(r => setReg(r));

    const onCtrlChange = () => {
      setNeedRefresh(true);
    };
    navigator.serviceWorker.addEventListener('controllerchange', onCtrlChange);

    const onMessage = (e) => {
      if (e.data?.type === 'SW_UPDATED') setNeedRefresh(true);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onCtrlChange);
      navigator.serviceWorker.removeEventListener('message', onMessage);
    };
  }, []);

  async function forceUpdate() {
    setBusy(true);
    // 1) vider les caches, 2) désenregistrer le SW (pour ne plus servir l'ancienne version),
    // 3) recharger : garantit de récupérer la nouvelle version.
    try { const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k))); } catch {}
    try {
      const regs = await navigator.serviceWorker?.getRegistrations?.() || [];
      await Promise.all(regs.map(r => r.unregister()));
    } catch {}
    window.location.reload();
  }

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9998] animate-fade-in">
      <div className="bg-gray-900 text-white rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-3">
        <RefreshCw size={16} className={`text-blue-400 shrink-0 ${busy ? 'animate-spin' : ''}`} />
        <span className="text-sm font-medium">Nouvelle version disponible</span>
        <button
          onClick={forceUpdate}
          disabled={busy}
          className="ml-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
        >
          {busy ? '...' : 'Mettre à jour'}
        </button>
      </div>
    </div>
  );
}
