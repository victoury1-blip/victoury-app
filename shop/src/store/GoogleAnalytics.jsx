import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const champ = 'w-full border border-gray-200 px-3 py-2.5 text-sm bg-white';
const label = 'block text-xs font-medium text-gray-500 mb-1.5';
const VIDE = { enabled: false, measurementId: '' };

export default function GoogleAnalytics() {
  const [r, setR] = useState(VIDE);
  const [enregistrement, setEnregistrement] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    supabase.from('shop_settings').select('value').eq('key', 'ga4').maybeSingle()
      .then(({ data }) => { if (data?.value) setR({ ...VIDE, ...data.value }); });
  }, []);

  const u = (k, v) => setR(x => ({ ...x, [k]: v }));

  async function enregistrer() {
    setEnregistrement(true);
    await supabase.from('shop_settings').upsert({
      key: 'ga4',
      value: { enabled: r.enabled, measurementId: String(r.measurementId || '').trim() },
      updated_at: new Date().toISOString(),
    });
    setEnregistrement(false);
    setOk(true);
    setTimeout(() => setOk(false), 2000);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-medium">Google Analytics</h1>
      <p className="text-xs text-gray-400 mt-1">D'où viennent vos visiteurs (Instagram, Facebook, TikTok, direct…) et ce qu'ils font sur le site</p>

      <div className="mt-5 bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between pb-5 border-b border-gray-100">
          <div>
            <p className="text-sm font-medium">Google Analytics 4</p>
            <p className="text-xs text-gray-400 mt-0.5">Trafic, sources de visite, pages vues, achats</p>
          </div>
          <button onClick={() => u('enabled', !r.enabled)}
            className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${r.enabled ? 'bg-blue-600' : 'bg-gray-200'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${r.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        {r.enabled && r.measurementId && (
          <p className="mt-4 flex items-center gap-2 bg-green-50 text-green-700 text-xs px-3 py-2.5 rounded-lg">
            ⚡ Script actif sur le site — Measurement ID : <code className="font-mono">{r.measurementId}</code>
          </p>
        )}

        <div className="pt-5 space-y-4">
          <div>
            <label className={label}>Measurement ID *</label>
            <input value={r.measurementId} onChange={e => u('measurementId', e.target.value)} placeholder="G-XXXXXXXXXX" className={champ} />
            <p className="mt-1 text-[11px] text-gray-400">Trouvez-le dans Google Analytics → Administration → Flux de données → votre flux Web</p>
          </div>
        </div>

        {/* Explique ce que la page traque déjà et comment lire les sources — sans
            ça, "d'où viennent les visiteurs" reste une question à laquelle
            personne ne sait répondre une fois le script activé. */}
        <div className="mt-6 bg-blue-50 text-blue-900 text-xs p-4 rounded-lg leading-relaxed">
          <p className="font-medium mb-1">📊 Ce qui est déjà suivi automatiquement</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Pages vues (à chaque navigation, pas seulement le premier chargement)</li>
            <li>Fiches produit consultées, ajouts au panier, débuts de commande, achats</li>
            <li><b>La source du visiteur</b> — Instagram, Facebook, TikTok, Google, direct… lue automatiquement
              dans le lien cliqué (les campagnes Meta/TikTok y ajoutent déjà ces paramètres) ou, à défaut, dans le site d'où vient le clic</li>
          </ul>
          <p className="font-medium mt-3 mb-1">📘 Comment configurer ?</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Créez une propriété GA4 sur analytics.google.com (gratuit)</li>
            <li>Administration → Flux de données → Ajouter un flux → Web, avec l'URL du site</li>
            <li>Copiez le Measurement ID (G-XXXXXXXXXX) ci-dessus</li>
            <li>Pour voir les sources : Rapports → Acquisition → Acquisition de trafic</li>
          </ol>
          <a href="https://analytics.google.com" target="_blank" rel="noreferrer" className="inline-block mt-2 underline">
            Ouvrir Google Analytics
          </a>
        </div>
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
