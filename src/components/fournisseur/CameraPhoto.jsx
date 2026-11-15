import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Camera, RotateCcw, Check, Loader2 } from 'lucide-react';

/* Appareil photo DANS la page (getUserMedia), comme le scanner.
   Pourquoi pas <input capture> : sur Android, il ouvre l'application Appareil
   photo ; pendant ce temps le système ferme souvent l'onglet de l'app faute
   de mémoire (« Impossible de terminer l'opération précédente. Mémoire
   insuffisante ») et la photo est perdue au retour. Ici on ne quitte jamais
   la page. Si la caméra est refusée/indisponible : onIndisponible() (l'appelant
   retombe alors sur le sélecteur de fichiers). */
export default function CameraPhoto({ onPhoto, onFermer, onIndisponible }) {
  const refVideo = useRef(null);
  const refFlux = useRef(null);
  const [pret, setPret] = useState(false);
  const [apercu, setApercu] = useState(null); // { url, blob }

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('indisponible');
        const flux = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1440 } },
          audio: false,
        });
        if (annule) { flux.getTracks().forEach(t => t.stop()); return; }
        refFlux.current = flux;
        const v = refVideo.current;
        if (v) { v.srcObject = flux; await v.play().catch(() => {}); }
        setPret(true);
      } catch {
        if (!annule) onIndisponible?.();
      }
    })();
    return () => {
      annule = true;
      refFlux.current?.getTracks().forEach(t => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => { if (apercu) URL.revokeObjectURL(apercu.url); }, [apercu]);

  function capturer() {
    const v = refVideo.current;
    if (!v?.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    c.toBlob(blob => { if (blob) setApercu({ url: URL.createObjectURL(blob), blob }); }, 'image/jpeg', 0.85);
  }

  function utiliser() {
    const fichier = new File([apercu.blob], `bon-${Date.now()}.jpg`, { type: 'image/jpeg' });
    onPhoto(fichier);
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] bg-black flex flex-col" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm font-semibold">Photo du bon</span>
        <button type="button" onClick={onFermer} aria-label="Fermer" className="p-2 rounded-full bg-white/10"><X size={18} /></button>
      </div>

      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        <video ref={refVideo} playsInline muted autoPlay
          className={`max-w-full max-h-full object-contain ${apercu ? 'hidden' : ''}`} />
        {apercu && <img src={apercu.url} alt="Aperçu" className="max-w-full max-h-full object-contain" />}
        {!pret && !apercu && (
          <span className="absolute flex items-center gap-2 text-white/80 text-sm"><Loader2 size={16} className="animate-spin" /> Ouverture de la caméra…</span>
        )}
      </div>

      <div className="px-6 py-5 flex items-center justify-center gap-6">
        {apercu ? (
          <>
            <button type="button" onClick={() => setApercu(null)}
              className="flex items-center gap-2 px-5 py-3 rounded-full bg-white/15 text-white font-semibold">
              <RotateCcw size={18} /> Reprendre
            </button>
            <button type="button" onClick={utiliser}
              className="flex items-center gap-2 px-5 py-3 rounded-full bg-emerald-500 text-white font-semibold">
              <Check size={18} /> Utiliser
            </button>
          </>
        ) : (
          <button type="button" onClick={capturer} disabled={!pret} aria-label="Prendre la photo"
            className="w-16 h-16 rounded-full bg-white border-4 border-white/40 flex items-center justify-center disabled:opacity-40">
            <Camera size={24} className="text-gray-900" />
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
