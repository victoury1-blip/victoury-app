import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const champ = 'w-full border border-gray-200 px-3 py-2.5 text-sm bg-white';
const label = 'block text-xs font-medium text-gray-500 mb-1.5';
const VIDE = { enabled: false, projectId: '' };

export default function MicrosoftClarity() {
  const [r, setR] = useState(VIDE);
  const [enregistrement, setEnregistrement] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    supabase.from('shop_settings').select('value').eq('key', 'microsoft_clarity').maybeSingle()
      .then(({ data }) => { if (data?.value) setR({ ...VIDE, ...data.value }); });
  }, []);

  const u = (k, v) => setR(x => ({ ...x, [k]: v }));

  async function enregistrer() {
    setEnregistrement(true);
    await supabase.from('shop_settings').upsert({
      key: 'microsoft_clarity',
      value: { enabled: r.enabled, projectId: String(r.projectId || '').trim() },
      updated_at: new Date().toISOString(),
    });
    setEnregistrement(false);
    setOk(true);
    setTimeout(() => setOk(false), 2000);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-medium">Microsoft Clarity</h1>
      <p className="text-xs text-gray-400 mt-1">Configuration du tracking et de l'analyse comportementale</p>

      <div className="mt-5 bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between pb-5 border-b border-gray-100">
          <div>
            <p className="text-sm font-medium">Microsoft Clarity</p>
            <p className="text-xs text-gray-400 mt-0.5">Enregistrements de sessions, heatmaps et analyses comportementales</p>
          </div>
          <button onClick={() => u('enabled', !r.enabled)}
            className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${r.enabled ? 'bg-blue-600' : 'bg-gray-200'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${r.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        {r.enabled && r.projectId && (
          <p className="mt-4 flex items-center gap-2 bg-green-50 text-green-700 text-xs px-3 py-2.5 rounded-lg">
            ⚡ Script actif sur le site — Project ID : <code className="font-mono">{r.projectId}</code>
          </p>
        )}

        <div className="pt-5 space-y-4">
          <div>
            <label className={label}>Project ID *</label>
            <input value={r.projectId} onChange={e => u('projectId', e.target.value)} className={champ} />
            <p className="mt-1 text-[11px] text-gray-400">Trouvez votre Project ID dans Clarity → Settings → Overview</p>
          </div>

          {/* Comme pour Meta : ce que le navigateur charge ne peut porter aucun
              secret. L'identifiant de projet, lui, n'en est pas un — c'est
              pourquoi, à la différence du jeton de Meta, il peut se régler ici. */}
          <div>
            <label className={label}>API Token (Data Export)</label>
            <div className={`${champ} flex items-center justify-between text-gray-400`}>
              <span>Non requis pour l'enregistrement des sessions</span>
            </div>
            <p className="mt-1 text-[11px] text-gray-400">
              Ce jeton sert uniquement à exporter les données via l'API de Clarity — une fonctionnalité que cette page ne propose pas.
              Le suivi lui-même (sessions, heatmaps) ne dépend que du Project ID ci-dessus.
            </p>
          </div>
        </div>

        <div className="mt-6 bg-blue-50 text-blue-900 text-xs p-4 rounded-lg leading-relaxed">
          <p className="font-medium mb-1">📘 Comment configurer ?</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Connectez-vous sur clarity.microsoft.com</li>
            <li>Créez ou sélectionnez votre projet</li>
            <li>Copiez le Project ID depuis Settings → Overview</li>
          </ol>
          <a href="https://clarity.microsoft.com" target="_blank" rel="noreferrer" className="inline-block mt-2 underline">
            Ouvrir le dashboard Clarity
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
