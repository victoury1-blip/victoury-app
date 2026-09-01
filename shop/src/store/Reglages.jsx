import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { enregistrerReglages } from '../lib/admin';
import { REGLAGES_DEFAUT } from '../lib/catalog';

const champ = 'w-full border border-gray-200 px-3 py-2.5 text-sm bg-white';
const label = 'block text-xs font-medium text-gray-500 mb-1.5';

export default function Reglages() {
  const [r, setR] = useState(REGLAGES_DEFAUT);
  const [enregistrement, setEnregistrement] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    supabase.from('shop_settings').select('value').eq('key', 'boutique').maybeSingle()
      .then(({ data }) => { if (data?.value) setR({ ...REGLAGES_DEFAUT, ...data.value }); });
  }, []);

  const u = (k, v) => setR(x => ({ ...x, [k]: v }));

  const majPalier = (i, k, v) => setR(x => {
    const paliers = [...(x.paliers || [])];
    paliers[i] = { ...paliers[i], [k]: v };
    return { ...x, paliers };
  });
  const ajouterPalier = () => setR(x => ({ ...x, paliers: [...(x.paliers || []), { rang: (x.paliers?.length || 0) + 2, pourcent: 0 }] }));
  const retirerPalier = (i) => setR(x => ({ ...x, paliers: x.paliers.filter((_, j) => j !== i) }));

  async function enregistrer() {
    setEnregistrement(true);
    const propre = {
      ...r,
      paliers: (r.paliers || []).map(p => ({ rang: parseInt(p.rang, 10) || 2, pourcent: parseFloat(p.pourcent) || 0 })),
      livraison: parseFloat(r.livraison) || 0,
      seuilGratuit: r.seuilGratuit ? parseFloat(r.seuilGratuit) : null,
    };
    await enregistrerReglages(propre);
    setEnregistrement(false);
    setOk(true);
    setTimeout(() => setOk(false), 2000);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-medium">Réglages</h1>

      <div className="mt-5 space-y-6">
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-xs tracking-widest uppercase text-gray-500 mb-3">Bandeau d'annonce</h2>
          <input value={r.annonce} onChange={e => u('annonce', e.target.value)} className={champ} />
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-xs tracking-widest uppercase text-gray-500 mb-1">Remises par quantité</h2>
          {/* La 2ᵉ paire à −20%, la 3ᵉ à −30% : le rang est la position dans le
              panier, du moins cher. */}
          <p className="text-xs text-gray-400 mb-3">Ex. : 2ᵉ article à −20 %, 3ᵉ à −30 %.</p>
          <div className="space-y-2">
            {(r.paliers || []).map((p, i) => (
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
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-xs tracking-widest uppercase text-gray-500 mb-3">Livraison & contact</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Frais de livraison (DH)</label>
              <input value={r.livraison} onChange={e => u('livraison', e.target.value)} type="number" min="0" className={champ} />
              <p className="mt-1 text-[11px] text-gray-400">0 = toujours gratuite</p>
            </div>
            <div>
              {/* Le seuil se compare au montant après remises, pas au sous-total
                  affiché : un code promo peut donc faire réapparaître des frais. */}
              <label className={label}>Livraison gratuite dès (DH)</label>
              <input value={r.seuilGratuit ?? ''} onChange={e => u('seuilGratuit', e.target.value)} type="number" min="0"
                placeholder="Laisser vide = jamais offerte" className={champ} />
            </div>
            <div>
              <label className={label}>Téléphone</label>
              <input value={r.telephone} onChange={e => u('telephone', e.target.value)} className={champ} />
            </div>
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-xs tracking-widest uppercase text-gray-500 mb-3">Meta Pixel</h2>
          <input value={r.pixelId} onChange={e => u('pixelId', e.target.value)} placeholder="ID du pixel" className={champ} />
        </section>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button onClick={enregistrer} disabled={enregistrement} className="bg-ink text-white px-6 py-3 text-xs tracking-widest uppercase disabled:opacity-60">
          {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {ok && <span className="text-xs text-green-600">Enregistré</span>}
      </div>
    </div>
  );
}
