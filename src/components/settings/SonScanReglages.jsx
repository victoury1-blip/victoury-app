import React, { useState } from 'react';
import { Play, Upload } from 'lucide-react';
import { useToast } from '../Toast';
import {
  lireReglagesSon, enregistrerReglagesSon, jouerBip, jouerErreur, debloquerAudio,
  SONS_SUCCES, SONS_ERREUR,
} from '../../lib/beep';

const MAX_FICHIER = 400 * 1024; // gardé dans le navigateur : un bip court suffit

function Interrupteur({ actif, onChange, couleur = 'bg-green-500' }) {
  return (
    <button type="button" role="switch" aria-checked={actif} onClick={() => onChange(!actif)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${actif ? couleur : 'bg-gray-300'}`}>
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${actif ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

/* Choix d'un son : sons intégrés + « mon fichier ». */
function ChoixSon({ titre, sons, valeur, perso, persoNom, onChoisir, onFichier, onRetirerFichier, onTester, couleur }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-600">{titre}</p>
        <button type="button" onClick={onTester}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-white text-[11px] font-semibold ${couleur}`}>
          <Play size={11} /> Tester
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {Object.entries(sons).map(([id, s]) => (
          <button key={id} type="button" onClick={() => onChoisir(id)}
            className={`px-3 py-2 rounded-lg text-xs font-medium border text-left transition ${
              valeur === id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {s.label}
          </button>
        ))}
        {perso && (
          <button type="button" onClick={() => onChoisir('perso')}
            className={`px-3 py-2 rounded-lg text-xs font-medium border text-left truncate transition ${
              valeur === 'perso' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`} title={persoNom}>
            🎵 {persoNom || 'Mon son'}
          </button>
        )}
      </div>
      <div className="flex items-center gap-3 mt-2">
        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-blue-600 hover:underline">
          <Upload size={12} /> {perso ? 'Changer mon son' : 'Importer mon son (mp3 / wav)'}
          <input type="file" accept="audio/*" className="hidden"
            onChange={e => { onFichier(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        {perso && (
          <button type="button" onClick={onRetirerFichier} className="text-[11px] text-red-500 hover:underline">Supprimer mon son</button>
        )}
      </div>
    </div>
  );
}

export default function SonScanReglages() {
  const toast = useToast();
  const [r, setR] = useState(lireReglagesSon);

  function changer(patch) {
    const suivant = { ...r, ...patch };
    try { enregistrerReglagesSon(suivant); setR(suivant); return suivant; }
    catch { toast.error('Fichier trop lourd pour être gardé sur cet appareil.'); return null; }
  }
  function tester(sorte, reglages = r) {
    debloquerAudio();
    (sorte === 'succes' ? jouerBip : jouerErreur)(reglages);
  }
  function choisir(sorte, id) {
    const s = changer({ [sorte]: id });
    if (s) tester(sorte, s);
  }
  function importer(sorte, fichier) {
    if (!fichier) return;
    if (!fichier.type.startsWith('audio/')) { toast.error('Choisissez un fichier audio (mp3, wav…).'); return; }
    if (fichier.size > MAX_FICHIER) { toast.error('Son trop long : choisissez un fichier de moins de 400 Ko (1–2 secondes).'); return; }
    const lecteur = new FileReader();
    lecteur.onload = ev => {
      const s = changer({ [sorte]: 'perso', [`${sorte}Perso`]: ev.target.result, [`${sorte}PersoNom`]: fichier.name });
      if (s) { toast.success('Son importé'); tester(sorte, s); }
    };
    lecteur.readAsDataURL(fichier);
  }
  function retirer(sorte) {
    const preset = sorte === 'succes' ? 'classique' : 'grave';
    changer({ [`${sorte}Perso`]: null, [`${sorte}PersoNom`]: null, ...(r[sorte] === 'perso' ? { [sorte]: preset } : {}) });
  }

  return (
    <div className="space-y-5 max-h-[65vh] overflow-y-auto -mx-1 px-1">
      <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-gray-700">Son au scan</p>
          <p className="text-xs text-gray-500">Ramassage, Retour et scan de la Liste des colis</p>
        </div>
        <Interrupteur actif={r.actif} onChange={v => changer({ actif: v })} />
      </div>

      <div className={r.actif ? '' : 'opacity-40 pointer-events-none'}>
        <label className="block text-xs font-semibold text-gray-600 mb-2">Volume : {r.volume}%</label>
        <input type="range" min="0" max="100" step="5" value={r.volume}
          onChange={e => changer({ volume: Number(e.target.value) })}
          onMouseUp={() => tester('succes')} onTouchEnd={() => tester('succes')}
          className="w-full accent-green-500" />
      </div>

      <div className={`space-y-5 ${r.actif ? '' : 'opacity-40 pointer-events-none'}`}>
        <ChoixSon titre="✅ Colis reconnu" sons={SONS_SUCCES} valeur={r.succes}
          perso={r.succesPerso} persoNom={r.succesPersoNom} couleur="bg-green-600 hover:bg-green-700"
          onChoisir={id => choisir('succes', id)} onFichier={f => importer('succes', f)}
          onRetirerFichier={() => retirer('succes')} onTester={() => tester('succes')} />
        <ChoixSon titre="❌ Erreur (introuvable, déjà scanné…)" sons={SONS_ERREUR} valeur={r.erreur}
          perso={r.erreurPerso} persoNom={r.erreurPersoNom} couleur="bg-red-500 hover:bg-red-600"
          onChoisir={id => choisir('erreur', id)} onFichier={f => importer('erreur', f)}
          onRetirerFichier={() => retirer('erreur')} onTester={() => tester('erreur')} />
      </div>

      <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-gray-700">Vibration</p>
          <p className="text-xs text-gray-500">Courte si reconnu, longue si erreur (Android ; l'iPhone ne vibre pas depuis un site)</p>
        </div>
        <Interrupteur actif={r.vibration} onChange={v => changer({ vibration: v })} couleur="bg-blue-500" />
      </div>

      <p className="text-[11px] text-gray-400 leading-relaxed">
        Réglage gardé sur cet appareil seulement. Sur iPhone, si rien ne sonne : retirez le mode silencieux (bouton sur le côté) et montez le volume.
      </p>
    </div>
  );
}
