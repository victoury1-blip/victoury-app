import React, { useEffect, useRef, useState } from 'react';

/* Les captures WhatsApp montrent souvent le nom/numéro du client en haut
   (ou "vu à" en bas) — recadrer avant d'envoyer plutôt qu'après, pour ne
   jamais publier une capture qui identifie un client. Deux repères
   horizontaux à glisser (haut/bas) : plus simple et plus rapide qu'un
   cadre libre, largement suffisant pour ce cas précis. */
export default function RecadrageModal({ fichier, onValider, onAnnuler }) {
  const [url, setUrl] = useState(null);
  const [haut, setHaut] = useState(0);
  const [bas, setBas] = useState(100);
  const [glisse, setGlisse] = useState(null); // 'haut' | 'bas' | null
  const conteneurRef = useRef(null);

  useEffect(() => {
    const u = URL.createObjectURL(fichier);
    setUrl(u);
    setHaut(0); setBas(100);
    return () => URL.revokeObjectURL(u);
  }, [fichier]);

  function pourcentageDepuisY(clientY) {
    const rect = conteneurRef.current.getBoundingClientRect();
    return Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));
  }

  function surDeplacement(e) {
    if (!glisse) return;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const p = pourcentageDepuisY(y);
    if (glisse === 'haut') setHaut(Math.min(p, bas - 3));
    else setBas(Math.max(p, haut + 3));
  }

  useEffect(() => {
    if (!glisse) return;
    const fin = () => setGlisse(null);
    window.addEventListener('pointermove', surDeplacement);
    window.addEventListener('pointerup', fin);
    return () => {
      window.removeEventListener('pointermove', surDeplacement);
      window.removeEventListener('pointerup', fin);
    };
  }, [glisse, haut, bas]);

  async function valider() {
    const img = new Image();
    img.src = url;
    await new Promise(r => { img.onload = r; });
    const y0 = Math.round((haut / 100) * img.naturalHeight);
    const y1 = Math.round((bas / 100) * img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = Math.max(1, y1 - y0);
    canvas.getContext('2d').drawImage(img, 0, y0, img.naturalWidth, canvas.height, 0, 0, img.naturalWidth, canvas.height);
    canvas.toBlob(blob => {
      onValider(new File([blob], fichier.name, { type: fichier.type || 'image/jpeg' }));
    }, fichier.type || 'image/jpeg', 0.92);
  }

  if (!url) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center p-4">
      <div className="bg-white rounded-lg p-4 max-w-sm w-full">
        <p className="text-sm text-gray-600 mb-3">
          Glissez les deux repères pour cacher le nom/numéro du client, puis validez.
        </p>
        <div ref={conteneurRef} className="relative select-none touch-none">
          <img src={url} alt="" className="w-full max-h-[60vh] object-contain pointer-events-none" />
          {/* Zones assombries hors du cadre gardé */}
          <div className="absolute inset-x-0 top-0 bg-black/60" style={{ height: `${haut}%` }} />
          <div className="absolute inset-x-0 bottom-0 bg-black/60" style={{ height: `${100 - bas}%` }} />
          <div onPointerDown={() => setGlisse('haut')}
            className="absolute inset-x-0 h-3 -mt-1.5 cursor-row-resize flex items-center"
            style={{ top: `${haut}%` }}>
            <div className="h-1 w-full bg-white shadow" />
          </div>
          <div onPointerDown={() => setGlisse('bas')}
            className="absolute inset-x-0 h-3 -mt-1.5 cursor-row-resize flex items-center"
            style={{ top: `${bas}%` }}>
            <div className="h-1 w-full bg-white shadow" />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onAnnuler} className="px-3 py-2 text-xs tracking-widest uppercase text-gray-500">Sans recadrage</button>
          <button onClick={valider} className="px-4 py-2 text-xs tracking-widest uppercase bg-ink text-white">Valider</button>
        </div>
      </div>
    </div>
  );
}
