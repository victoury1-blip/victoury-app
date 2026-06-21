import React, { useState, useEffect } from 'react';
import { X, Share, PlusSquare } from 'lucide-react';

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isStandalone() {
  return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

export default function IOSInstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isIOS() || isStandalone()) return;
    const dismissed = localStorage.getItem('ios_install_dismissed');
    if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) return;
    const timer = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    setShow(false);
    localStorage.setItem('ios_install_dismissed', String(Date.now()));
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[70] p-4 pb-[env(safe-area-inset-bottom,16px)]">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 max-w-md mx-auto">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center text-lg font-black shrink-0">V</div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-gray-900">Installer VICTOURY</h3>
            <p className="text-xs text-gray-500 mt-1">
              Pour recevoir les notifications et avoir l'app sur votre écran d'accueil :
            </p>
            <div className="mt-2 space-y-1.5">
              <p className="text-xs text-gray-700 flex items-center gap-2">
                <Share size={14} className="text-blue-600 shrink-0" />
                Appuyez sur <strong>Partager</strong>
              </p>
              <p className="text-xs text-gray-700 flex items-center gap-2">
                <PlusSquare size={14} className="text-blue-600 shrink-0" />
                Puis <strong>Sur l'écran d'accueil</strong>
              </p>
            </div>
          </div>
          <button onClick={dismiss} className="p-1 hover:bg-gray-100 rounded-lg shrink-0">
            <X size={16} className="text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
