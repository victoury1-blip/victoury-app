import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const champ = 'w-full border border-gray-200 px-3 py-2.5 text-sm bg-white';
const label = 'block text-xs font-medium text-gray-500 mb-1.5';
const VIDE = { enabled: false, pixelId: '' };

export default function TikTokPixel() {
  const [r, setR] = useState(VIDE);
  const [enregistrement, setEnregistrement] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    supabase.from('shop_settings').select('value').eq('key', 'tiktok_pixel').maybeSingle()
      .then(({ data }) => { if (data?.value) setR({ ...VIDE, ...data.value }); });
  }, []);

  const u = (k, v) => setR(x => ({ ...x, [k]: v }));

  async function enregistrer() {
    setEnregistrement(true);
    await supabase.from('shop_settings').upsert({
      key: 'tiktok_pixel',
      value: { enabled: r.enabled, pixelId: String(r.pixelId || '').trim() },
      updated_at: new Date().toISOString(),
    });
    setEnregistrement(false);
    setOk(true);
    setTimeout(() => setOk(false), 2000);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-medium">TikTok Pixel</h1>
      <p className="text-xs text-gray-400 mt-1">Configuration du suivi des conversions TikTok Ads</p>

      <div className="mt-5 bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between pb-5 border-b border-gray-100">
          <div>
            <p className="text-sm font-medium">TikTok Pixel</p>
            <p className="text-xs text-gray-400 mt-0.5">Suivez les conversions et optimisez vos publicités TikTok</p>
          </div>
          <button onClick={() => u('enabled', !r.enabled)}
            className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${r.enabled ? 'bg-blue-600' : 'bg-gray-200'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${r.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        {r.enabled && r.pixelId && (
          <p className="mt-4 flex items-center gap-2 bg-green-50 text-green-700 text-xs px-3 py-2.5 rounded-lg">
            ⚡ Script actif sur le site — Pixel ID : <code className="font-mono">{r.pixelId}</code>
          </p>
        )}

        <div className="pt-5 space-y-4">
          <div>
            <label className={label}>Pixel ID *</label>
            <input value={r.pixelId} onChange={e => u('pixelId', e.target.value)} className={champ} placeholder="CVAG6PJC77U2KF3E3AV0" />
            <p className="mt-1 text-[11px] text-gray-400">Trouvez votre Pixel ID dans TikTok Events Manager → Data Sources</p>
          </div>
        </div>

        <div className="mt-6 bg-blue-50 text-blue-900 text-xs p-4 rounded-lg leading-relaxed">
          <p className="font-medium mb-1">📘 كيفاش تعمرها؟</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>دخل لـ TikTok Ads Manager → Events Manager</li>
            <li>اختار الـ Pixel ديالك</li>
            <li>نسخ الـ Pixel ID (فوق العنوان، مثلا CVAG6PJC77U2KF3E3AV0)</li>
            <li>لصقو هنا، فعّل السويتش، وسجل</li>
          </ol>
          <p className="mt-2">الأحداث المتتبعة أوتوماتيكيا: PageView, ViewContent, AddToCart, InitiateCheckout, CompletePayment.</p>
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
