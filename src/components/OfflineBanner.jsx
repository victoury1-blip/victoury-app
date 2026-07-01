import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export default function OfflineBanner() {
  const [status, setStatus] = useState(navigator.onLine ? 'online' : 'offline');

  useEffect(() => {
    let backTimer;
    const goOffline = () => { clearTimeout(backTimer); setStatus('offline'); };
    const goOnline  = () => {
      setStatus('back');
      backTimer = setTimeout(() => setStatus('online'), 2500);
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online',  goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online',  goOnline);
      clearTimeout(backTimer);
    };
  }, []);

  if (status === 'online') return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 py-2 text-sm font-semibold animate-fade-in ${
      status === 'offline' ? 'bg-red-600 text-white' : 'bg-emerald-500 text-white'
    }`}>
      {status === 'offline'
        ? <><WifiOff size={15} /> Pas de connexion internet</>
        : <><Wifi size={15} /> Connexion rétablie</>}
    </div>
  );
}
