import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const champ = 'w-full border border-gray-200 px-3 py-2.5 text-sm bg-white';
const label = 'block text-xs font-medium text-gray-500 mb-1.5';
const VIDE = { enabled: false, pixelId: '', testCode: '' };

export default function MetaPixel() {
  const [r, setR] = useState(VIDE);
  const [enregistrement, setEnregistrement] = useState(false);
  const [ok, setOk] = useState(false);
  const [statutJeton, setStatutJeton] = useState(null); // null = pas encore vérifié
  const [test, setTest] = useState(null);

  useEffect(() => {
    supabase.from('shop_settings').select('value').eq('key', 'meta_pixel').maybeSingle()
      .then(({ data }) => { if (data?.value) setR({ ...VIDE, ...data.value }); });
    fetch('/api/meta-capi').then(r => r.json()).then(d => setStatutJeton(!!d.configured)).catch(() => setStatutJeton(false));
  }, []);

  const u = (k, v) => setR(x => ({ ...x, [k]: v }));

  async function enregistrer() {
    setEnregistrement(true);
    await supabase.from('shop_settings').upsert({
      key: 'meta_pixel',
      value: { enabled: r.enabled, pixelId: String(r.pixelId || '').replace(/\D/g, ''), testCode: r.testCode || '' },
      updated_at: new Date().toISOString(),
    });
    setEnregistrement(false);
    setOk(true);
    setTimeout(() => setOk(false), 2000);
  }

  async function tester() {
    setTest({ busy: true });
    try {
      const res = await fetch('/api/meta-capi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pixelId: String(r.pixelId || '').replace(/\D/g, ''),
          testCode: r.testCode || undefined,
          events: [{
            event_name: 'PageView', event_time: Math.floor(Date.now() / 1000),
            event_id: `test-${Date.now()}`, action_source: 'website',
            user_data: { client_user_agent: navigator.userAgent },
          }],
        }),
      });
      const d = await res.json();
      setTest(res.ok
        ? { ok: true, msg: `Reçu par Meta (fbtrace_id ${d.fbtrace_id || '—'})` }
        : { ok: false, msg: d.error || `Erreur ${res.status}` });
    } catch (e) {
      setTest({ ok: false, msg: e.message || 'Échec de la connexion' });
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-medium">Meta Pixel</h1>
      <p className="text-xs text-gray-400 mt-1">Configuration du suivi Facebook / Meta Pixel</p>

      <div className="mt-5 bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between pb-5 border-b border-gray-100">
          <div>
            <p className="text-sm font-medium">Meta Pixel (Facebook Pixel)</p>
            <p className="text-xs text-gray-400 mt-0.5">Suivez les conversions et optimisez vos publicités Facebook</p>
          </div>
          <button onClick={() => u('enabled', !r.enabled)}
            className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${r.enabled ? 'bg-blue-600' : 'bg-gray-200'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${r.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        <div className="pt-5 space-y-4">
          <div>
            <label className={label}>Pixel ID *</label>
            <input value={r.pixelId} onChange={e => u('pixelId', e.target.value)} className={champ} />
            <p className="mt-1 text-[11px] text-gray-400">Trouvez votre Pixel ID dans Events Manager → Paramètres des données</p>
          </div>

          {/* Le jeton d'accès n'est JAMAIS saisi ni stocké ici : il vivrait sinon
              dans une base lisible par n'importe quel visiteur du site — c'est
              l'inverse même d'un secret. Il se règle une fois, côté serveur. */}
          <div>
            <label className={label}>Access Token (Conversions API)</label>
            <div className={`${champ} flex items-center justify-between`}>
              <span className="text-gray-400">
                {statutJeton === null ? 'Vérification…' : statutJeton ? 'Configuré sur le serveur' : 'Non configuré'}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${statutJeton ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                {statutJeton ? '✓' : '!'}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-gray-400">
              Se configure une seule fois dans Vercel → Settings → Environment Variables → <code className="bg-gray-100 px-1">META_ACCESS_TOKEN</code>,
              jamais depuis cette page : c'est ce qui l'empêche d'être visible par un visiteur du site.
            </p>
          </div>

          <div>
            <label className={label}>Test Event Code (optionnel)</label>
            <input value={r.testCode} onChange={e => u('testCode', e.target.value)} className={champ} />
            <p className="mt-1 text-[11px] text-gray-400">Utilisez ce code pour tester vos évènements dans Events Manager → Test Events</p>
          </div>

          <button onClick={tester} disabled={!r.pixelId || test?.busy}
            className="px-4 py-2 border border-gray-200 text-xs tracking-wide uppercase disabled:opacity-50">
            {test?.busy ? 'Test en cours…' : 'Tester la connexion'}
          </button>
          {test && !test.busy && (
            <p className={`text-xs ${test.ok ? 'text-green-700' : 'text-red-600'}`}>{test.msg}</p>
          )}
        </div>

        <div className="mt-6 bg-blue-50 text-blue-900 text-xs p-4 rounded-lg leading-relaxed">
          <p className="font-medium mb-1">📘 Comment configurer ?</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Allez sur Events Manager</li>
            <li>Sélectionnez votre Pixel → Paramètres</li>
            <li>Copiez le Pixel ID</li>
            <li>Conversions API → Générer un jeton d'accès, puis collez-le dans Vercel (voir ci-dessus)</li>
            <li>Pour tester : Test Events → Générer un code de test</li>
          </ol>
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
