import React, { useMemo, useState } from 'react';
import { ChevronDown, Plus, Trash2, Wallet, CalendarDays, TrendingUp, X } from 'lucide-react';
import { grouperParMois, moisPrecedent } from '../../lib/depenses';

/* Fenêtre « Dépenses » du Rapport de Profit : un bloc par mois (total,
 * répartition par catégorie, barre comparée au plus gros mois), le mois le
 * plus récent ouvert, les autres repliés. En tête : ce mois, le mois dernier
 * et la moyenne mensuelle. */

const fmt = (n) => Number(n || 0).toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const jourMois = (d) => (d && d.length >= 10 ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '—');
const aujourdhui = () => new Date().toISOString().slice(0, 10);

const PASTILLE = {
  facebook: 'bg-blue-50 text-blue-700 ring-blue-200',
  tiktok: 'bg-pink-50 text-pink-700 ring-pink-200',
  livraison: 'bg-orange-50 text-orange-700 ring-orange-200',
  autres: 'bg-gray-100 text-gray-700 ring-gray-200',
};
const BARRE = { facebook: 'bg-blue-500', tiktok: 'bg-pink-500', livraison: 'bg-orange-500', autres: 'bg-gray-400' };

function Tuile({ icon: Icon, label, value, note }) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-200 bg-white px-2.5 sm:px-4 py-2.5 sm:py-3">
      <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-gray-500 truncate">
        <Icon size={13} className="hidden sm:block shrink-0" /> {label}
      </div>
      <div className="mt-1 text-sm sm:text-lg font-black text-gray-900 tabular-nums truncate">{fmt(value)} <span className="hidden sm:inline text-xs font-semibold text-gray-400">MAD</span></div>
      {note && <div className="text-[11px] text-gray-400">{note}</div>}
    </div>
  );
}

export default function DepensesModal({ depenses, categories, onAjouter, onSupprimer, onClose }) {
  const mois = useMemo(() => grouperParMois(depenses), [depenses]);
  const [ouverts, setOuverts] = useState(() => new Set(mois[0] ? [mois[0].cle] : []));
  const [form, setForm] = useState({ label: '', amount: '', category: 'facebook', date: aujourdhui() });

  const nomCat = (v) => categories.find(c => c.value === v)?.label || v;
  const cleCeMois = aujourdhui().slice(0, 7);
  const totalDe = (cle) => mois.find(m => m.cle === cle)?.total || 0;
  const datés = mois.filter(m => m.cle !== 'sans-date');
  const moyenne = datés.length ? datés.reduce((s, m) => s + m.total, 0) / datés.length : 0;
  const max = Math.max(1, ...mois.map(m => m.total));

  const basculer = (cle) => setOuverts(prev => {
    const n = new Set(prev);
    if (n.has(cle)) n.delete(cle); else n.add(cle);
    return n;
  });

  function ajouter() {
    if (!form.amount) return;
    onAjouter({
      label: form.label.trim() || nomCat(form.category),
      amount: parseFloat(form.amount) || 0,
      category: form.category,
      date: form.date || aujourdhui(),
    });
    setOuverts(prev => new Set(prev).add((form.date || aujourdhui()).slice(0, 7)));
    setForm(f => ({ ...f, label: '', amount: '' }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40" />
      <div className="relative bg-gray-50 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* En-tête */}
        <div className="bg-gradient-to-r from-indigo-700 to-purple-700 px-5 py-4 text-white flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">Dépenses</h2>
            <p className="text-xs text-white/70">Publicité et frais, mois par mois — déduits du sous-total pour le profit net.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10" aria-label="Fermer"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Résumé */}
          <div className="grid grid-cols-3 gap-2">
            <Tuile icon={Wallet} label="Ce mois-ci" value={totalDe(cleCeMois)} />
            <Tuile icon={CalendarDays} label="Mois dernier" value={totalDe(moisPrecedent(cleCeMois))} />
            <Tuile icon={TrendingUp} label="Moyenne / mois" value={moyenne} note={`${datés.length} mois`} />
          </div>

          {/* Mois par mois */}
          {mois.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white py-8 text-center text-sm text-gray-400">Aucune dépense enregistrée.</div>
          )}
          <div className="space-y-2">
            {mois.map(m => {
              const ouvert = ouverts.has(m.cle);
              const cats = Object.entries(m.parCategorie).filter(([, v]) => v > 0);
              return (
                <div key={m.cle} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <button type="button" onClick={() => basculer(m.cle)} className="w-full text-left px-4 py-3 hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="font-bold text-gray-900 whitespace-nowrap">{m.libelle}</span>
                          {m.cle === cleCeMois && <span className="text-[10px] font-bold uppercase bg-green-100 text-green-700 rounded-full px-2 py-0.5">En cours</span>}
                          <span className="text-xs text-gray-400">{m.items.length} dépense{m.items.length > 1 ? 's' : ''}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {cats.map(([c, v]) => (
                            <span key={c} className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ring-1 ${PASTILLE[c] || PASTILLE.autres}`}>
                              {nomCat(c)} · {fmt(v)}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-black text-gray-900 tabular-nums">{fmt(m.total)}</div>
                        <div className="text-[10px] font-semibold text-gray-400">MAD</div>
                      </div>
                      <ChevronDown size={18} className={`text-gray-400 transition-transform ${ouvert ? 'rotate-180' : ''}`} />
                    </div>
                    {/* Part de chaque catégorie, à l'échelle du plus gros mois */}
                    <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden flex" style={{ width: `${Math.max(4, (m.total / max) * 100)}%` }}>
                      {cats.map(([c, v]) => (
                        <div key={c} className={BARRE[c] || BARRE.autres} style={{ width: `${(v / (m.total || 1)) * 100}%` }} />
                      ))}
                    </div>
                  </button>

                  {ouvert && (
                    <div className="border-t border-gray-100">
                      {m.items.map((t, i) => (
                        <div key={t.id} className={`flex items-center gap-3 px-4 py-2 text-sm ${i % 2 ? 'bg-gray-50' : 'bg-white'}`}>
                          <span className="w-11 shrink-0 font-mono text-xs text-gray-500">{jourMois(t.date)}</span>
                          <span className="flex-1 min-w-0 truncate font-medium text-gray-800">{t.label}</span>
                          <span className={`hidden sm:inline text-[11px] font-semibold rounded-full px-2 py-0.5 ring-1 ${PASTILLE[t.category || 'facebook'] || PASTILLE.autres}`}>
                            {nomCat(t.category || 'facebook')}
                          </span>
                          <span className="w-28 text-right font-bold text-gray-900 tabular-nums">{fmt(t.amount)}</span>
                          <button onClick={() => onSupprimer(t.id)} title="Supprimer"
                            className="p-1 rounded text-gray-300 hover:bg-red-50 hover:text-red-500">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Nouvelle dépense */}
        <div className="border-t border-gray-200 bg-white px-4 sm:px-5 py-3">
          <p className="text-xs font-semibold text-gray-600 flex items-center gap-1 mb-2"><Plus size={12} /> Nouvelle dépense</p>
          <div className="grid grid-cols-2 sm:grid-cols-[1.1fr_1fr_1.4fr_0.9fr_auto] gap-2 [&>*]:min-w-0">
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300">
              {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
            <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="Description (facultatif)"
              className="col-span-2 sm:col-span-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
            <input type="number" min={0} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') ajouter(); }}
              placeholder="Montant MAD"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
            <button onClick={ajouter} disabled={!form.amount}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-40">
              <Plus size={14} /> Ajouter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
