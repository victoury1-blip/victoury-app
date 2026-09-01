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

  async function enregistrer() {
    setEnregistrement(true);
    // `paliers` n'est plus réglé ici : il se déduit désormais des remises
    // actives de /store/remises, et ne doit pas être réécrit depuis cette page.
    const { paliers, ...sansPaliers } = r;
    const propre = {
      ...sansPaliers,
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

      {/* Le logo, le favicon et le bandeau d'annonce ont leur propre page
          (/store/theme), les remises par quantité aussi (/store/remises) —
          avec, pour les deux, un aperçu en temps réel. */}
      <div className="mt-5 space-y-6">
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

      </div>
      {/* Le Meta Pixel a sa propre page : /store/meta-pixel — il y a plus qu'un
          identifiant à régler, et le jeton d'accès n'a rien à faire ici. */}

      <div className="mt-5 flex items-center gap-3">
        <button onClick={enregistrer} disabled={enregistrement} className="bg-ink text-white px-6 py-3 text-xs tracking-widest uppercase disabled:opacity-60">
          {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {ok && <span className="text-xs text-green-600">Enregistré</span>}
      </div>
    </div>
  );
}
