import React, { useEffect, useState } from 'react';
import { Trash2, Upload, GripVertical } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { televerserPhoto, enregistrerAvis } from '../lib/admin';

/* Preuve sociale sous forme de captures d'écran — pas un système de note
   avec formulaire client, ce que l'ancien site n'avait pas non plus.
   L'admin choisit et dépose lui-même les messages à montrer. */
export default function AvisListe() {
  const [avis, setAvis] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [traine, setTraine] = useState(null);

  useEffect(() => {
    supabase.from('shop_settings').select('value').eq('key', 'avis').maybeSingle()
      .then(({ data }) => setAvis(Array.isArray(data?.value) ? data.value : []));
  }, []);

  async function sauver(liste) {
    setAvis(liste);
    await enregistrerAvis(liste);
  }

  async function ajouterFichiers(fichiers) {
    if (!fichiers?.length) return;
    setEnvoi(true);
    try {
      const urls = await Promise.all([...fichiers].map(televerserPhoto));
      await sauver([...avis, ...urls.map(url => ({ id: crypto.randomUUID(), url }))]);
    } catch (e) {
      alert(e.message || 'Envoi impossible');
    } finally {
      setEnvoi(false);
    }
  }

  function retirer(id) {
    sauver(avis.filter(a => a.id !== id));
  }

  function deposer(indexCible) {
    if (traine === null || traine === indexCible) { setTraine(null); return; }
    const reordonnee = [...avis];
    const [dep] = reordonnee.splice(traine, 1);
    reordonnee.splice(indexCible, 0, dep);
    setTraine(null);
    sauver(reordonnee);
  }

  if (!avis) return null;

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-medium">Avis clients</h1>
      <p className="text-sm text-gray-500 mt-1">
        Déposez des captures d'écran (WhatsApp, messages...) — elles s'affichent sur la page d'accueil,
        dans l'ordre ci-dessous. Glissez-déposez pour réordonner.
      </p>

      <label className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-xs tracking-widest uppercase cursor-pointer bg-white">
        <Upload size={14} /> {envoi ? 'Envoi…' : 'Ajouter des captures'}
        <input type="file" accept="image/*" multiple hidden disabled={envoi} onChange={e => ajouterFichiers(e.target.files)} />
      </label>

      {avis.length === 0 ? (
        <p className="mt-6 text-sm text-gray-400">Aucun avis déposé pour l'instant.</p>
      ) : (
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {avis.map((a, i) => (
            <div key={a.id} draggable
              onDragStart={() => setTraine(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => deposer(i)}
              onDragEnd={() => setTraine(null)}
              className={`relative group border border-gray-200 rounded-lg overflow-hidden bg-white ${traine === i ? 'opacity-40' : ''}`}>
              <img src={a.url} alt="" className="w-full aspect-[3/4] object-cover" />
              <div className="absolute top-1.5 left-1.5 bg-white/90 rounded p-1 cursor-grab"><GripVertical size={13} className="text-gray-400" /></div>
              <button onClick={() => retirer(a.id)}
                className="absolute top-1.5 right-1.5 bg-white/90 rounded p-1 text-gray-400 hover:text-red-500">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
