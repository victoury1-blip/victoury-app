import React from 'react';
import { Plus, Trash2, RotateCcw } from 'lucide-react';
import { grilleEnTexte, lirePlage, GRILLE_TAILLES } from '../lib/guideTailles';

const COLONNES = [
  { k: 'poids', label: 'Poids (kg)', ex: '54-62' },
  { k: 'hauteur', label: 'Taille (cm)', ex: '155-165' },
];

/* Tableau du guide des tailles, modifiable case par case. Les plages se
   tapent "40-54" ; le poids est obligatoire, la taille en cm optionnelle
   (« — » côté client si vide). */
export default function EditeurGrilleTailles({ grille, onChange }) {
  const lignes = grilleEnTexte(grille);
  const maj = (i, k, v) => onChange(lignes.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const ajouter = () => onChange([...lignes, { taille: '', poids: '', hauteur: '' }]);
  const retirer = (i) => onChange(lignes.filter((_, j) => j !== i));

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-gray-700">Tableau des mesures</p>
        <button type="button" onClick={() => onChange(grilleEnTexte(GRILLE_TAILLES))}
          className="text-[11px] text-gray-500 hover:text-ink inline-flex items-center gap-1">
          <RotateCcw size={12} /> Grille standard
        </button>
      </div>
      <div className="border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-xs min-w-[320px]">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="py-2 px-2 text-left font-medium">Taille</th>
              {COLONNES.map(c => <th key={c.k} className="py-2 px-2 text-left font-medium">{c.label}</th>)}
              <th />
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => (
              <tr key={i} className={i % 2 ? 'bg-gray-50' : 'bg-white'}>
                <td className="p-1.5">
                  <input value={l.taille} onChange={e => maj(i, 'taille', e.target.value)} placeholder="M"
                    className="w-14 border border-gray-200 rounded-md px-2 py-1.5 font-semibold uppercase" />
                </td>
                {COLONNES.map(c => {
                  const invalide = l[c.k] && !lirePlage(l[c.k]);
                  const manque = c.k === 'poids' && !l[c.k];
                  return (
                    <td key={c.k} className="p-1.5">
                      <input value={l[c.k]} onChange={e => maj(i, c.k, e.target.value)} placeholder={c.ex}
                        className={`w-full min-w-[72px] border rounded-md px-2 py-1.5 ${invalide || manque ? 'border-red-300 bg-red-50' : 'border-gray-200'}`} />
                    </td>
                  );
                })}
                <td className="p-1.5 text-right">
                  <button type="button" onClick={() => retirer(i)} aria-label="Supprimer la ligne"
                    className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={ajouter}
        className="mt-2 text-xs text-blue-600 hover:underline inline-flex items-center gap-1"><Plus size={12} /> Ajouter une taille</button>
      <p className="text-[11px] text-gray-400 mt-1">
        Écrire les plages comme « 54-62 ». La calculatrice « Quelle est ma taille ? » se base sur le poids, puis la taille (cm) pour les personnes grandes.
      </p>
    </div>
  );
}
