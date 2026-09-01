import React, { useEffect, useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';

const champ = 'border border-gray-200 px-3 py-2 text-sm bg-white';
const VIDE_REGLE = () => ({ id: crypto.randomUUID(), nom: '', active: true, paliers: [{ rang: 2, pourcent: 20 }] });

export default function RemisesListe() {
  const [remises, setRemises] = useState(null);
  const [edite, setEdite] = useState(null);

  useEffect(() => {
    supabase.from('shop_settings').select('value').eq('key', 'remises').maybeSingle()
      .then(({ data }) => setRemises(Array.isArray(data?.value) ? data.value : []));
  }, []);

  async function sauver(liste) {
    setRemises(liste);
    await supabase.from('shop_settings').upsert({ key: 'remises', value: liste, updated_at: new Date().toISOString() });
  }

  function enregistrerRegle() {
    if (!edite.nom.trim()) return;
    const propre = { ...edite, paliers: edite.paliers.filter(p => p.rang >= 2).map(p => ({ rang: Number(p.rang), pourcent: Number(p.pourcent) || 0 })) };
    const existe = remises.some(r => r.id === propre.id);
    sauver(existe ? remises.map(r => (r.id === propre.id ? propre : r)) : [...remises, propre]);
    setEdite(null);
  }

  function basculer(r) { sauver(remises.map(x => (x.id === r.id ? { ...x, active: !x.active } : x))); }
  function retirer(r) {
    if (!confirm(`Supprimer la remise « ${r.nom} » ?`)) return;
    sauver(remises.filter(x => x.id !== r.id));
  }

  const majPalier = (i, k, v) => setEdite(x => ({ ...x, paliers: x.paliers.map((p, j) => (j === i ? { ...p, [k]: v } : p)) }));
  const ajouterPalier = () => setEdite(x => ({ ...x, paliers: [...x.paliers, { rang: (x.paliers.length ? Math.max(...x.paliers.map(p => p.rang)) : 1) + 1, pourcent: 0 }] }));
  const retirerPalier = (i) => setEdite(x => ({ ...x, paliers: x.paliers.filter((_, j) => j !== i) }));

  const resume = (paliers) => paliers.length
    ? paliers.map(p => `${p.rang}${p.rang === 2 ? 'ème' : p.rang === 3 ? 'ème' : 'e'} article -${p.pourcent}%`).join(' · ')
    : 'Aucun palier';

  if (!remises) return <p className="text-sm text-gray-400">Chargement…</p>;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium">Remises</h1>
          <p className="text-xs text-gray-400 mt-0.5">Remises progressives selon la quantité d'articles au panier</p>
        </div>
        <button onClick={() => setEdite(VIDE_REGLE())} className="flex items-center gap-1.5 bg-ink text-white px-4 py-2.5 text-xs tracking-widest uppercase">
          <Plus size={14} /> Créer une remise
        </button>
      </div>

      {/* Seules les remises ACTIVES comptent ; s'il y en a plusieurs sur le même
          palier, la plus avantageuse pour le client s'applique — jamais leur
          somme, qui dépasserait ce qui a été annoncé. */}
      {remises.filter(r => r.active).length > 1 && (
        <p className="mt-3 text-[11px] text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
          ⚠ Plusieurs remises actives à la fois : sur un même palier, seule la plus avantageuse pour le client s'applique.
        </p>
      )}

      {edite && (
        <div className="mt-4 bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Nom de la remise</label>
            <input value={edite.nom} onChange={e => setEdite(x => ({ ...x, nom: e.target.value }))}
              placeholder="Ex. : 2ème -20%" className={`${champ} w-full`} />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-2">Paliers</p>
            <div className="space-y-2">
              {edite.paliers.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400">Article n°</span>
                  <input value={p.rang} onChange={e => majPalier(i, 'rang', e.target.value)} type="number" min="2" className={`${champ} w-20`} />
                  <span className="text-gray-400">→ −</span>
                  <input value={p.pourcent} onChange={e => majPalier(i, 'pourcent', e.target.value)} type="number" min="0" max="100" className={`${champ} w-20`} />
                  <span className="text-gray-400">%</span>
                  <button onClick={() => retirerPalier(i)} className="ml-auto text-xs text-gray-400 hover:text-red-500">Retirer</button>
                </div>
              ))}
            </div>
            <button onClick={ajouterPalier} className="mt-2 text-xs text-gray-500">+ Ajouter un palier</button>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={enregistrerRegle} className="bg-ink text-white px-4 py-2 text-xs tracking-widest uppercase">Enregistrer</button>
            <button onClick={() => setEdite(null)} className="px-4 py-2 text-xs tracking-widest uppercase text-gray-500">Annuler</button>
          </div>
        </div>
      )}

      <div className="mt-5 bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="text-left px-4 py-3">Nom</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Paliers</th>
              <th className="text-left px-4 py-3">Statut</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {remises.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium cursor-pointer" onClick={() => setEdite(r)}>{r.nom}</td>
                <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700">% Remise progressive</span></td>
                <td className="px-4 py-3 text-xs text-gray-500">{resume(r.paliers)}</td>
                <td className="px-4 py-3">
                  <button onClick={() => basculer(r)} className={`text-xs px-2.5 py-1 rounded-full ${r.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {r.active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => retirer(r)} className="text-gray-300 hover:text-red-500"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {remises.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">Aucune remise</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
