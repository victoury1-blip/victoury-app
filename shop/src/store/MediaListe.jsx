import React, { useEffect, useState } from 'react';
import { Upload, Trash2, Copy, Check, Sparkles, CheckSquare, X } from 'lucide-react';
import { listerMedias, supprimerMedia, televerserPhoto, recompresserMedia } from '../lib/admin';

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
  const [conversion, setConversion] = useState('');
  const [conversionTout, setConversionTout] = useState(false);
  const [modeSelection, setModeSelection] = useState(false);
  const [selection, setSelection] = useState(new Set());

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

  async function convertirEnWeb(nom) {
    setConversion(nom);
    try {
      await recompresserMedia(nom);
      // Le nom (donc l'URL) ne change pas, mais le poids si : recharger
      // pour afficher le nouveau chiffre plutôt qu'un poids resté figé.
      await recharger();
    } catch (e) { alert(e.message || 'Conversion impossible'); }
    finally { setConversion(''); }
  }

  async function convertirToutEnWeb() {
    // Le poids en octets ne dit rien de la présence d'une miniature : une
    // photo déposée avant cette fonctionnalité peut peser peu (déjà
    // compressée par le téléphone) tout en restant à sa pleine résolution
    // (ex. 900x1150 affichée dans une vignette de 250px) faute de fichier
    // "-thumb" associé. On régénère donc systématiquement tout le monde,
    // pas seulement les fichiers au-dessus du seuil "lourd".
    if (!medias.length) return;
    if (!confirm(`Régénérer les miniatures de ${medias.length} photo(s) ?`)) return;
    setConversionTout(true);
    for (const m of medias) {
      try { await recompresserMedia(m.nom); } catch { /* une photo en échec ne doit pas arrêter les autres */ }
    }
    await recharger();
    setConversionTout(false);
  }

  function basculerSelection(nom) {
    setSelection(s => {
      const n = new Set(s);
      n.has(nom) ? n.delete(nom) : n.add(nom);
      return n;
    });
  }

  function annulerSelection() {
    setModeSelection(false);
    setSelection(new Set());
  }

  async function supprimerSelection() {
    const noms = [...selection];
    if (!noms.length) return;
    if (!confirm(`Supprimer ${noms.length} photo(s) ? Les pages qui les utilisent encore afficheront une image cassée.`)) return;
    setMedias(m => m.filter(x => !selection.has(x.nom)));
    annulerSelection();
    try { await Promise.all(noms.map(supprimerMedia)); }
    catch (e) { alert(e.message || 'Suppression impossible'); recharger(); }
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Médiathèque</h1>
          <p className="text-sm text-gray-500 mt-0.5">{medias.length} fichier{medias.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          {modeSelection ? (
            <>
              <span className="text-sm text-gray-500">{selection.size} sélectionnée{selection.size > 1 ? 's' : ''}</span>
              <button type="button" onClick={supprimerSelection} disabled={!selection.size}
                className="inline-flex items-center gap-2 bg-red-500 text-white text-sm px-4 py-2.5 rounded-lg hover:bg-red-600 disabled:opacity-40">
                <Trash2 size={15} /> Supprimer
              </button>
              <button type="button" onClick={annulerSelection}
                className="inline-flex items-center gap-2 border border-gray-200 text-sm px-4 py-2.5 rounded-lg hover:bg-gray-50">
                <X size={15} /> Annuler
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setModeSelection(true)}
                className="inline-flex items-center gap-2 border border-gray-200 text-sm px-4 py-2.5 rounded-lg hover:bg-gray-50">
                <CheckSquare size={15} /> Sélectionner
              </button>
              {medias.length > 0 && (
                <button type="button" onClick={convertirToutEnWeb} disabled={conversionTout}
                  className="inline-flex items-center gap-2 border border-gray-200 text-sm px-4 py-2.5 rounded-lg hover:bg-gray-50 disabled:opacity-60">
                  <Sparkles size={15} /> {conversionTout ? 'Conversion…' : 'Régénérer les miniatures pour le web'}
                </button>
              )}
              <label className="inline-flex items-center gap-2 bg-ink text-white text-sm px-4 py-2.5 rounded-lg cursor-pointer hover:opacity-90">
                <Upload size={15} /> {envoi ? 'Envoi…' : 'Ajouter des fichiers'}
                <input type="file" accept="image/*" multiple hidden disabled={envoi}
                  onChange={e => { surDepot(Array.from(e.target.files || [])); e.target.value = ''; }} />
              </label>
            </>
          )}
        </div>
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
          {filtres.map(m => {
            const cochee = selection.has(m.nom);
            return (
              <div key={m.nom}
                onClick={modeSelection ? () => basculerSelection(m.nom) : undefined}
                className={`group relative bg-white border rounded-lg overflow-hidden ${
                  modeSelection ? 'cursor-pointer' : ''} ${cochee ? 'border-ink ring-2 ring-ink' : 'border-gray-200'}`}>
                <div className="aspect-square bg-sand">
                  <img src={m.url} alt={m.nom} loading="lazy" className="w-full h-full object-cover" />
                </div>
                <div className="p-2">
                  <p className="text-[11px] text-gray-600 truncate" title={m.nom}>{m.nom}</p>
                  <p className="text-[10px] text-gray-400">{formatTaille(m.taille)}</p>
                </div>
                {modeSelection ? (
                  <div className={`absolute top-1.5 right-1.5 w-5 h-5 rounded border-2 flex items-center justify-center ${
                    cochee ? 'bg-ink border-ink' : 'bg-white/90 border-gray-300'}`}>
                    {cochee && <Check size={13} className="text-white" />}
                  </div>
                ) : (
                  <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" onClick={() => convertirEnWeb(m.nom)} disabled={conversion === m.nom} title="Régénérer la miniature"
                      className="bg-white rounded-full p-1.5 shadow text-gray-500 hover:text-ink disabled:opacity-60">
                      <Sparkles size={13} />
                    </button>
                    <button type="button" onClick={() => copierLien(m.url, m.nom)} title="Copier le lien"
                      className="bg-white rounded-full p-1.5 shadow text-gray-500 hover:text-ink">
                      {copie === m.nom ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                    <button type="button" onClick={() => supprimer(m.nom)} title="Supprimer"
                      className="bg-white rounded-full p-1.5 shadow text-gray-500 hover:text-red-500">
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
