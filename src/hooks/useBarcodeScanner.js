import { useEffect, useRef } from 'react';
import jsQR from 'jsqr';

/**
 * Scanner continu de codes-barres sur un élément <video>.
 * - getUserMedia caméra arrière + autofocus continu
 * - BarcodeDetector (natif) puis jsQR en secours, sur le centre de l'image
 * - la caméra reste ouverte : cooldown anti-relecture du même code
 *
 * @param {boolean} active   démarre/arrête le scanner
 * @param {string}  videoId  id de l'élément <video>
 * @param {(code: string) => void} onCode  appelé à chaque code détecté
 * @param {(reason: string) => void} onError  erreur caméra lisible
 */
export default function useBarcodeScanner(active, videoId, onCode, onError) {
  const onCodeRef = useRef(onCode);
  const onErrorRef = useRef(onError);
  useEffect(() => { onCodeRef.current = onCode; }, [onCode]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    if (!active) return;
    let stream, timerId, stopped = false;

    async function start() {
      const video = document.getElementById(videoId);
      if (!video || stopped) return;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
        video.srcObject = stream;
        await video.play();
        await new Promise(r => {
          if (video.readyState >= 3) { r(); return; }
          video.addEventListener('canplay', r, { once: true });
        });
        if (stopped) return;

        // autofocus continu si supporté (crucial pour les QR de près)
        const track = stream.getVideoTracks()[0];
        try {
          const caps = track.getCapabilities?.() || {};
          if (caps.focusMode?.includes('continuous')) {
            await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
          }
        } catch {}

        // BarcodeDetector peut exister mais retourner toujours 0 (module MLKit absent) → jsQR en parallèle
        const detector = 'BarcodeDetector' in window
          ? new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13', 'code_39', 'aztec', 'data_matrix', 'pdf417'] })
          : null;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        let lastCode = '', lastAt = 0;
        function onDetected(raw) {
          const now = Date.now();
          if (raw === lastCode && now - lastAt < 4000) return;
          if (now - lastAt < 1200) return;
          lastCode = raw;
          lastAt = now;
          onCodeRef.current?.(raw);
        }

        async function tick() {
          if (stopped) return;
          if (video.readyState >= 3 && video.videoWidth > 0) {
            // recadrer le centre (zone du cadre blanc) — plus fiable et plus rapide
            const vw = video.videoWidth, vh = video.videoHeight;
            const side = Math.floor(Math.min(vw, vh) * 0.8);
            const sx = Math.floor((vw - side) / 2), sy = Math.floor((vh - side) / 2);
            canvas.width = side;
            canvas.height = side;
            ctx.drawImage(video, sx, sy, side, side, 0, 0, side, side);

            let found = false;
            if (detector) {
              try {
                const barcodes = await detector.detect(canvas);
                if (barcodes.length > 0 && !stopped) {
                  found = true;
                  onDetected(barcodes[0].rawValue);
                }
              } catch {}
            }
            if (!found && !stopped) {
              const imgData = ctx.getImageData(0, 0, side, side);
              const code = jsQR(imgData.data, side, side, { inversionAttempts: 'attemptBoth' });
              if (code && code.data && !stopped) {
                onDetected(code.data);
              }
            }
          }
          if (!stopped) timerId = setTimeout(tick, 250);
        }

        timerId = setTimeout(tick, 250);
      } catch (err) {
        if (stopped) return;
        const msg = String(err?.message || err || '');
        const reason = msg.includes('NotAllowed') || err?.name === 'NotAllowedError'
          ? 'Permission caméra refusée — Paramètres → Apps → Chrome → Autorisations → Caméra'
          : msg.includes('NotFound') ? 'Aucune caméra détectée'
          : msg.includes('NotReadable') ? 'Caméra occupée par une autre app'
          : `Erreur caméra: ${msg || 'inconnue'}`;
        onErrorRef.current?.(reason);
      }
    }

    start();
    return () => {
      stopped = true;
      clearTimeout(timerId);
      try { stream?.getTracks().forEach(t => t.stop()); } catch {}
      const v = document.getElementById(videoId);
      if (v) v.srcObject = null;
    };
  }, [active, videoId]);
}
