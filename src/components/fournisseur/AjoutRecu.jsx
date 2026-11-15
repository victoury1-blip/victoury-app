import React, { useRef, useState } from 'react';
import { Camera, Upload, Paperclip, Loader2, X } from 'lucide-react';
import { useToast } from '../Toast';
import CameraPhoto from './CameraPhoto';
import { envoyerPhotoBon } from '../../lib/photosFournisseur';

/* « + Reçu » sur un versement DÉJÀ enregistré : ajoute la photo du reçu
   (virement, chèque…) sans créer de nouveau versement ni retaper le montant. */
export default function AjoutRecu({ factureId, onAjoute, libelle = 'Reçu' }) {
  const toast = useToast();
  const [ouvert, setOuvert] = useState(false);
  const [camera, setCamera] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const refFichier = useRef(null);
  const refPhoto = useRef(null);

  async function envoyer(fichiers) {
    const liste = [...(fichiers || [])].filter(f => f.type?.startsWith('image/') || f.type === 'application/pdf');
    if (!liste.length) return;
    setEnvoi(true);
    const ajoutes = [];
    for (const f of liste) {
      try { ajoutes.push(await envoyerPhotoBon(`${factureId}/versements`, f)); }
      catch (e) {
        toast.error(/bucket/i.test(e.message || '')
          ? 'Espace photos pas encore créé : passez le SQL « fournisseur_photos » dans Supabase.'
          : `Envoi impossible : ${e.message}`);
      }
    }
    setEnvoi(false);
    setOuvert(false);
    if (ajoutes.length) { onAjoute(ajoutes); toast.success('Reçu ajouté'); }
  }

  if (envoi) return <span className="flex items-center gap-1 text-[11px] text-gray-500 shrink-0"><Loader2 size={12} className="animate-spin" /> Envoi…</span>;

  return (
    <span className="flex items-center gap-1 shrink-0">
      {!ouvert ? (
        <button type="button" onClick={() => setOuvert(true)} title="Ajouter le reçu de ce versement"
          className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 border border-dashed border-gray-300 rounded-md px-1.5 py-0.5 hover:bg-gray-100">
          <Paperclip size={11} /> + {libelle}
        </button>
      ) : (
        <>
          <button type="button" onClick={() => setCamera(true)} title="Prendre une photo"
            className="p-1 rounded-md bg-gray-900 text-white"><Camera size={13} /></button>
          <button type="button" onClick={() => refFichier.current?.click()} title="Importer"
            className="p-1 rounded-md border border-gray-300 text-gray-700"><Upload size={13} /></button>
          <button type="button" onClick={() => setOuvert(false)} title="Annuler"
            className="p-1 rounded-md text-gray-400"><X size={13} /></button>
        </>
      )}
      <input ref={refFichier} type="file" accept="image/*,application/pdf" multiple className="hidden"
        onChange={e => { envoyer(e.target.files); e.target.value = ''; }} />
      <input ref={refPhoto} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => { envoyer(e.target.files); e.target.value = ''; }} />
      {camera && (
        <CameraPhoto onFermer={() => setCamera(false)}
          onPhoto={f => { setCamera(false); envoyer([f]); }}
          onIndisponible={() => { setCamera(false); refPhoto.current?.click(); }} />
      )}
    </span>
  );
}
