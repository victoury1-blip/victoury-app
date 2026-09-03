import React, { useEffect, useState } from 'react';
import { Upload, Trash2, Copy, Check } from 'lucide-react';
import { listerMedias, supprimerMedia, televerserPhoto } from '../lib/admin';

const formatTaille = (o) => o > 1024 * 1024 ? `${(o / 1024 / 1024).toFixed(1)} Mo` : `${Math.round(o / 1024)} Ko`;

/* Toutes les photos déjà déposées (logo, hero, produits…) au même endroit —
   avant cette page, retrouver l'URL d'une photo utilisée ailleurs voulait
   dire rouvrir la fiche produit ou le thème qui l'avait reçue. */
export default function MediaListe() {
  const [medias, setMedias] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [copie, setCopie] = useState('');

  const recharger = () => listerMedias().then(setMedias).catch(() => {}).finally(() => setChargement(false));
  useEffect(() => { recharger(); }, []);

  async function surDepot(fichiers) {
    if (!fichiers?.length) return;
    setEnvoi(true);
    try {
      for (const f of fichiers) await televerserPhoto(f);
      await recharger();
    } catch (e) { alert(e.message || 'Envoi impossible'); }
    finally { setEnvoi(false); }
  }

  async function supprimer(nom) {
    if (!confirm('Supprimer cette photo ? Les pages qui l\'utilisent encore afficheront une image cassée.')) return;
    setMedias(m => m.filter(x => x.nom !== nom));
    try { await supprimerMedia(nom); } catch (e) { alert(e.message || 'Suppression impossible'); recharger(); }
  }

  function copierLien(url, nom) {
    navigator.clipboard?.writeText(url).then(() => {
      setCopie(nom);
      setTimeout(() => setCopie(''), 1500);
    });
  }

  const filtres = medias.filter(m => m.nom.toLowerCase().includes(recherche.toLowerCase()));

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Médiathèque</h1>
          <p className="text-sm text-gray-500 mt-0.5">{medias.length} fichier{medias.length > 1 ? 's' : ''}</p>
        </div>
        <label className="inline-flex items-center gap-2 bg-ink text-white text-sm px-4 py-2.5 rounded-lg cursor-pointer hover:opacity-90">
          <Upload size={15} /> {envoi ? 'Envoi…' : 'Ajouter des fichiers'}
          <input type="file" accept="image/*" multiple hidden disabled={envoi}
            onChange={e => { surDepot(Array.from(e.target.files || [])); e.target.value = ''; }} />
        </label>
      </div>

      <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher…"
        className="mt-5 w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm bg-white" />

      {/* Glisser-déposer : la même surface reçoit un fichier choisi par clic
          ou lâché depuis le Finder/Explorateur, un seul geste à retenir. */}
      <label onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); surDepot(Array.from(e.dataTransfer.files || [])); }}
        className="mt-4 flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-8 text-sm text-gray-400 cursor-pointer hover:border-gray-300 hover:text-gray-500">
        <Upload size={16} /> Glisser-déposer des images ici, ou cliquer pour sélectionner
        <input type="file" accept="image/*" multiple hidden disabled={envoi}
          onChange={e => { surDepot(Array.from(e.target.files || [])); e.target.value = ''; }} />
      </label>

      {chargement ? (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => <div key={i} className="aspect-square bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : filtres.length === 0 ? (
        <p className="mt-10 text-center text-sm text-gray-400">
          {medias.length === 0 ? 'Aucune photo déposée pour l\'instant.' : 'Aucun résultat.'}
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          {filtres.map(m => (
            <div key={m.nom} className="group relative bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="aspect-square bg-sand">
                <img src={m.url} alt={m.nom} loading="lazy" className="w-full h-full object-cover" />
              </div>
              <div className="p-2">
                <p className="text-[11px] text-gray-600 truncate" title={m.nom}>{m.nom}</p>
                <p className="text-[10px] text-gray-400">{formatTaille(m.taille)}</p>
              </div>
              <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button type="button" onClick={() => copierLien(m.url, m.nom)} title="Copier le lien"
                  className="bg-white rounded-full p-1.5 shadow text-gray-500 hover:text-ink">
                  {copie === m.nom ? <Check size={13} /> : <Copy size={13} />}
                </button>
                <button type="button" onClick={() => supprimer(m.nom)} title="Supprimer"
                  className="bg-white rounded-full p-1.5 shadow text-gray-500 hover:text-red-500">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
