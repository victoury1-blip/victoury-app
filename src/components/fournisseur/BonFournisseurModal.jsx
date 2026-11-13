import React, { useEffect, useRef, useState } from 'react';
import { X, Camera, Upload, Trash2, FileText, Loader2 } from 'lucide-react';
import { useToast } from '../Toast';
import { envoyerPhotoBon, liensPhotosBon, supprimerPhotoBon, versIso, versFr } from '../../lib/photosFournisseur';

/* Bon d'un fournisseur : date à laquelle la marchandise a été prise, et
   photos du bon papier (appareil photo du téléphone ou fichier importé). */
export default function BonFournisseurModal({ facture, onClose, onDatePrise, onAjouterPhotos, onRetirerPhoto }) {
  const toast = useToast();
  const [liens, setLiens] = useState({});
  const [envoi, setEnvoi] = useState(0);
  const [agrandie, setAgrandie] = useState(null);
  const refPhoto = useRef(null);
  const refImport = useRef(null);
  const photos = facture.photos || [];

  useEffect(() => {
    const chemins = photos.map(p => p.path).filter(p => !liens[p]);
    if (!chemins.length) return;
    liensPhotosBon(chemins).then(l => setLiens(x => ({ ...x, ...l })))
      .catch(e => toast.error(`Photos illisibles : ${e.message}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.length]);

  async function envoyer(fichiers) {
    const liste = [...(fichiers || [])].filter(f => f.type.startsWith('image/') || f.type === 'application/pdf');
    if (!liste.length) return;
    setEnvoi(n => n + liste.length);
    const ajoutees = [];
    for (const f of liste) {
      try { ajoutees.push(await envoyerPhotoBon(facture.id, f)); }
      catch (e) {
        toast.error(/bucket/i.test(e.message || '')
          ? 'Espace photos pas encore créé : passez le SQL « fournisseur_photos » dans Supabase.'
          : `Envoi impossible : ${e.message}`);
      } finally { setEnvoi(n => n - 1); }
    }
    if (ajoutees.length) {
      onAjouterPhotos(ajoutees);
      toast.success(ajoutees.length > 1 ? `${ajoutees.length} photos ajoutées` : 'Photo ajoutée');
    }
  }

  async function retirer(p) {
    if (!confirm('Supprimer cette photo du bon ?')) return;
    try { await supprimerPhotoBon(p.path); } catch { /* déjà absente : on la retire quand même */ }
    onRetirerPhoto(p.path);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">Bon {facture.ref}</h2>
            <p className="text-xs text-gray-400">Créé le {facture.date}</p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} /></button>
        </div>

        <div className="px-5 py-4 space-y-5 overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">📦 Marchandise prise le</label>
            <input type="date" value={versIso(facture.datePrise)} max={new Date().toISOString().slice(0, 10)}
              onChange={e => onDatePrise(versFr(e.target.value))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">🧾 Photos du bon du fournisseur</label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => refPhoto.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-semibold">
                <Camera size={14} /> Prendre une photo
              </button>
              <button type="button" onClick={() => refImport.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-50">
                <Upload size={14} /> Importer
              </button>
              {envoi > 0 && <span className="flex items-center gap-1 text-xs text-gray-500"><Loader2 size={13} className="animate-spin" /> Envoi…</span>}
            </div>
            {/* capture : ouvre directement l'appareil photo sur téléphone. */}
            <input ref={refPhoto} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => { envoyer(e.target.files); e.target.value = ''; }} />
            <input ref={refImport} type="file" accept="image/*,application/pdf" multiple className="hidden"
              onChange={e => { envoyer(e.target.files); e.target.value = ''; }} />

            {photos.length === 0 ? (
              <p className="mt-3 text-xs text-gray-400">Aucune photo pour ce bon.</p>
            ) : (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {photos.map(p => (
                  <div key={p.path} className="relative group aspect-[3/4] rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                    {p.type === 'pdf' ? (
                      <a href={liens[p.path]} target="_blank" rel="noreferrer" className="w-full h-full flex flex-col items-center justify-center text-gray-500 text-[11px] p-2 text-center">
                        <FileText size={28} /> <span className="mt-1 truncate w-full">{p.nom}</span>
                      </a>
                    ) : liens[p.path] ? (
                      <button type="button" onClick={() => setAgrandie(liens[p.path])} className="w-full h-full">
                        <img src={liens[p.path]} alt={p.nom} className="w-full h-full object-cover" />
                      </button>
                    ) : (
                      <div className="w-full h-full animate-pulse bg-gray-100" />
                    )}
                    <button type="button" onClick={() => retirer(p)} title="Supprimer"
                      className="absolute top-1 right-1 p-1 rounded-md bg-white/90 text-red-500 shadow">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold">Terminé</button>
        </div>
      </div>

      {agrandie && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={e => { e.stopPropagation(); setAgrandie(null); }}>
          <img src={agrandie} alt="" className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </div>
  );
}
