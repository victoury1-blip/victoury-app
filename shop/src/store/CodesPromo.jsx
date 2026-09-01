import React, { useEffect, useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { listerCodes, enregistrerCode, supprimerCode } from '../lib/admin';

const champ = 'border border-gray-200 px-3 py-2.5 text-sm bg-white';
const VIDE = { code: '', kind: 'percent', value: '', min_total: '', max_uses: '' };

export default function CodesPromo() {
  const [codes, setCodes] = useState([]);
  const [form, setForm] = useState(VIDE);

  const recharger = () => listerCodes().then(setCodes).catch(() => {});
  useEffect(() => { recharger(); }, []);

  async function ajouter() {
    if (!form.code.trim() || !form.value) return;
    await enregistrerCode({
      code: form.code.trim().toUpperCase(), kind: form.kind, value: parseFloat(form.value) || 0,
      min_total: parseFloat(form.min_total) || 0, max_uses: form.max_uses ? parseInt(form.max_uses, 10) : null,
      is_active: true,
    });
    setForm(VIDE);
    recharger();
  }

  async function basculer(c) {
    await enregistrerCode({ id: c.id, is_active: !c.is_active });
    recharger();
  }

  async function retirer(c) {
    if (!confirm(`Supprimer le code « ${c.code} » ?`)) return;
    await supprimerCode(c.id);
    recharger();
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-medium">Codes promo</h1>

      <div className="mt-4 bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="CODE" className={champ} />
          <select value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value }))} className={champ}>
            <option value="percent">Pourcentage</option>
            <option value="amount">Montant fixe (DH)</option>
          </select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <input value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} type="number" min="0"
            placeholder={form.kind === 'percent' ? '% de remise' : 'DH de remise'} className={champ} />
          <input value={form.min_total} onChange={e => setForm(f => ({ ...f, min_total: e.target.value }))} type="number" min="0"
            placeholder="Panier minimum" className={champ} />
          <input value={form.max_uses} onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))} type="number" min="1"
            placeholder="Utilisations max" className={champ} />
        </div>
        <button onClick={ajouter} className="flex items-center gap-1.5 bg-ink text-white px-4 py-2.5 text-xs tracking-widest uppercase">
          <Plus size={14} /> Créer le code
        </button>
      </div>

      <div className="mt-5 bg-white border border-gray-200 rounded-xl divide-y divide-gray-50">
        {codes.map(c => (
          <div key={c.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium font-mono">{c.code}</p>
              <p className="text-xs text-gray-400">
                {c.kind === 'percent' ? `−${c.value}%` : `−${c.value} DH`}
                {c.min_total > 0 && ` · dès ${c.min_total} DH`}
                {c.max_uses && ` · ${c.used_count}/${c.max_uses} utilisés`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => basculer(c)}
                className={`text-xs px-2.5 py-1 rounded-full ${c.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {c.is_active ? 'Actif' : 'Inactif'}
              </button>
              <button onClick={() => retirer(c)} className="text-gray-300 hover:text-red-500"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
        {codes.length === 0 && <p className="px-4 py-8 text-center text-sm text-gray-400">Aucun code promo</p>}
      </div>
    </div>
  );
}
