import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, FileText, ExternalLink } from 'lucide-react';
import { liensPhotosBon } from '../../lib/photosFournisseur';

/* Vignettes des reçus d'un versement + visionneuse plein écran dans l'app
   (au lieu d'un nouvel onglet), comme pour les photos de la marchandise. */
export default function RecusVersement({ recus = [] }) {
  const [liens, setLiens] = useState({});
  const [ouvert, setOuvert] = useState(null); // index affiché
  const cle = recus.map(r => r.path).join('|');

  useEffect(() => {
    const chemins = recus.map(r => r.path).filter(p => !liens[p]);
    if (!chemins.length) return;
    liensPhotosBon(chemins).then(l => setLiens(x => ({ ...x, ...l }))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);

  if (!recus.length) return null;

  return (
    <>
      <div className="flex items-center gap-1.5">
        {recus.map((r, i) => (
          <button key={r.path} type="button" onClick={() => setOuvert(i)} title="Voir le reçu"
            className="w-9 h-9 rounded-md overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0 hover:ring-2 hover:ring-blue-300 transition">
            {r.type === 'pdf'
              ? <FileText size={16} className="text-gray-500" />
              : liens[r.path]
                ? <img src={liens[r.path]} alt="Reçu" className="w-full h-full object-cover" loading="lazy" />
                : <span className="w-full h-full animate-pulse bg-gray-100" />}
          </button>
        ))}
      </div>
      {ouvert !== null && (
        <Visionneuse recus={recus} liens={liens} index={ouvert} onIndex={setOuvert} onFermer={() => setOuvert(null)} />
      )}
    </>
  );
}

function Visionneuse({ recus, liens, index, onIndex, onFermer }) {
  const r = recus[index];
  const url = liens[r.path];
  const n = recus.length;
  useEffect(() => {
    const touche = e => {
      if (e.key === 'Escape') onFermer();
      if (e.key === 'ArrowRight' && n > 1) onIndex((index + 1) % n);
      if (e.key === 'ArrowLeft' && n > 1) onIndex((index - 1 + n) % n);
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, [index, n, onFermer, onIndex]);

  return createPortal(
    <div className="fixed inset-0 z-[80] bg-black/95 flex flex-col" role="dialog" aria-modal="true" onClick={onFermer}>
      <div className="flex items-center justify-between px-4 py-3 text-white" onClick={e => e.stopPropagation()}>
        <span className="text-sm font-semibold">Reçu{n > 1 ? ` ${index + 1} / ${n}` : ''}</span>
        <div className="flex items-center gap-2">
          {url && (
            <a href={url} target="_blank" rel="noreferrer" title="Ouvrir / télécharger"
              className="p-2 rounded-full bg-white/10"><ExternalLink size={18} /></a>
          )}
          <button type="button" onClick={onFermer} aria-label="Fermer" className="p-2 rounded-full bg-white/10"><X size={18} /></button>
        </div>
      </div>
      <div className="flex-1 relative flex items-center justify-center p-3 overflow-hidden">
        {!url ? (
          <span className="text-white/70 text-sm">Chargement…</span>
        ) : r.type === 'pdf' ? (
          <a href={url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
            className="flex flex-col items-center gap-3 text-white">
            <FileText size={56} /> <span className="font-semibold">Ouvrir le PDF</span>
          </a>
        ) : (
          <img src={url} alt="Reçu" onClick={e => e.stopPropagation()} className="max-w-full max-h-full object-contain rounded-md" />
        )}
        {n > 1 && (
          <>
            <button type="button" aria-label="Précédent" onClick={e => { e.stopPropagation(); onIndex((index - 1 + n) % n); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/15 text-white"><ChevronLeft size={22} /></button>
            <button type="button" aria-label="Suivant" onClick={e => { e.stopPropagation(); onIndex((index + 1) % n); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/15 text-white"><ChevronRight size={22} /></button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
