import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Sparkles, X, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';

/* Parse fr « jj/mm/aaaa » et ISO « aaaa-mm-jj » */
function parseD(s) {
  if (!s) return null;
  let m = String(s).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  m = String(s).match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return null;
}

/* Résumé compact des données envoyé à l'IA (pas les 2000 commandes brutes). */
function buildDigest(orders) {
  const now = new Date();
  const day = (n) => { const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
  const refDate = (o) => {
    if (o.createdAt) { const d = new Date(o.createdAt); if (!isNaN(d)) return d; }
    return parseD(o.dateAdded);
  };
  const inRange = (o, from) => { const d = refDate(o); return d && d >= from; };
  const sum = (list) => Math.round(list.reduce((s, o) => s + (parseFloat(o.price) || 0), 0));

  const byStatus = {};
  orders.forEach(o => { byStatus[o.status] = (byStatus[o.status] || 0) + 1; });

  const agg = (keyFn, list) => {
    const m = {};
    list.forEach(o => {
      const k = keyFn(o);
      if (!k) return;
      if (!m[k]) m[k] = { total: 0, livre: 0, refuse: 0, ca: 0 };
      m[k].total++;
      if (o.status === 'livre') { m[k].livre++; m[k].ca += parseFloat(o.price) || 0; }
      if (['refuse', 'annule', 'retour_recu'].includes(o.status)) m[k].refuse++;
    });
    return Object.fromEntries(
      Object.entries(m).sort((a, b) => b[1].total - a[1].total).slice(0, 15)
        .map(([k, v]) => [k, { ...v, ca: Math.round(v.ca) }])
    );
  };

  const monthKey = (o) => { const d = refDate(o); return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : null; };
  const parMois = {};
  orders.forEach(o => {
    const k = monthKey(o); if (!k) return;
    if (!parMois[k]) parMois[k] = { commandes: 0, livrees: 0, ca_livre: 0 };
    parMois[k].commandes++;
    if (o.status === 'livre') { parMois[k].livrees++; parMois[k].ca_livre += parseFloat(o.price) || 0; }
  });
  Object.values(parMois).forEach(v => { v.ca_livre = Math.round(v.ca_livre); });

  const livre = orders.filter(o => o.status === 'livre');
  const done = orders.filter(o => ['livre', 'refuse', 'annule', 'retour_recu'].includes(o.status));

  return {
    date_aujourdhui: now.toLocaleDateString('fr-MA'),
    total_commandes: orders.length,
    par_statut: byStatus,
    ca_total_livre_dh: sum(livre),
    taux_livraison_pct: done.length ? Math.round((livre.length / done.length) * 100) : null,
    aujourdhui: { commandes: orders.filter(o => inRange(o, day(0))).length, livrees: orders.filter(o => inRange(o, day(0)) && o.status === 'livre').length },
    '7_derniers_jours': { commandes: orders.filter(o => inRange(o, day(6))).length, ca_livre_dh: sum(orders.filter(o => inRange(o, day(6)) && o.status === 'livre')) },
    '30_derniers_jours': { commandes: orders.filter(o => inRange(o, day(29))).length, ca_livre_dh: sum(orders.filter(o => inRange(o, day(29)) && o.status === 'livre')) },
    par_mois: parMois,
    top_villes: agg(o => (o.recipient?.city || '').trim().toLowerCase() || null, orders),
    top_produits: agg(o => o.products?.[0]?.name || o.product?.name || null, orders),
    par_livreur: agg(o => { const d = o.recipient?.delivery; return typeof d === 'string' ? d : d?.nom; }, orders),
  };
}

const SUGGESTIONS = [
  'شحال ربحت هاد الشهر؟',
  'شنو أحسن مدينة عندي؟',
  'شحال نسبة الرفض ديالي؟',
  'شنو أكثر منتج كيتباع؟',
];

export default function AssistantWidget({ orders = [] }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const digest = useMemo(() => (open ? buildDigest(orders) : null), [open, orders]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, loading]);

  async function ask(q) {
    const question = (q || input).trim();
    if (!question || loading) return;
    setInput('');
    setMsgs(prev => [...prev, { role: 'user', text: question }]);
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch('/api/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ question, digest: digest || buildDigest(orders) }),
      });
      const j = await r.json().catch(() => ({}));
      setMsgs(prev => [...prev, { role: 'ai', text: r.ok ? (j.answer || '—') : (j.error || `Erreur ${r.status}`) }]);
    } catch (e) {
      setMsgs(prev => [...prev, { role: 'ai', text: 'تعذّر الاتصال بالمساعد. تأكد من الإنترنت وحاول مرة أخرى.' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Bouton flottant */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-300/50 flex items-center justify-center hover:scale-105 transition-transform"
        title="Assistant IA"
      >
        {open ? <X size={22} /> : <Sparkles size={22} />}
      </button>

      {/* Panneau de chat */}
      {open && (
        <div className="fixed bottom-24 right-5 z-40 w-[min(400px,calc(100vw-2rem))] h-[min(560px,calc(100vh-8rem))] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-fade-in">
          <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 flex items-center gap-2">
            <Sparkles size={18} className="text-yellow-300" />
            <div>
              <p className="text-white font-bold text-sm leading-tight">Assistant Victoury</p>
              <p className="text-white/70 text-[11px] leading-tight">سول على الداتا ديالك بالدارجة</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50" dir="auto">
            {msgs.length === 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-center text-gray-400 text-xs">جرب واحد من هاد الأسئلة 👇</p>
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => ask(s)}
                    className="block w-full text-right px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-indigo-50 hover:border-indigo-200 transition" dir="rtl">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div dir="auto" className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                  m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="p-3 border-t border-gray-200 bg-white flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') ask(); }}
              placeholder="سول سؤال..."
              dir="auto"
              className="flex-1 px-3 py-2 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <button onClick={() => ask()} disabled={loading || !input.trim()}
              className="px-3 py-2 bg-indigo-600 text-white rounded-xl disabled:opacity-40 hover:bg-indigo-700 transition">
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
