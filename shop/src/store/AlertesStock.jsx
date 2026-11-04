import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle, ChevronDown, Plus, Ban, Pencil } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { taillesEpuisees, nettoyerManques, cleTaille, CLE_MANQUES } from '../lib/alertesStock';
import { miniature } from '../lib/img';

/* Bandeau en haut de l'administration : tailles épuisées des ensembles,
 * avec de quoi les réapprovisionner sur place, ou les marquer « Manque de
 * stock » quand aucun réassort n'est prévu (l'alerte disparaît). */
export default function AlertesStock() {
  const { pathname } = useLocation();
  const [produits, setProduits] = useState(null);
  const [manques, setManques] = useState([]);
  const [ouvert, setOuvert] = useState(false);
  const [saisies, setSaisies] = useState({});
  const [enCours, setEnCours] = useState('');

  const charger = useCallback(async () => {
    const [{ data: ps }, { data: reglage }] = await Promise.all([
      supabase.from('shop_products')
        .select('id, name, status, images:shop_product_images(url, position), collection:shop_collections(name), sizes:shop_product_sizes(id, size, stock, position)')
        .eq('status', 'Actif'),
      supabase.from('shop_settings').select('value').eq('key', CLE_MANQUES).maybeSingle(),
    ]);
    const liste = Array.isArray(reglage?.value) ? reglage.value : [];
    const propre = nettoyerManques(ps || [], liste);
    if (propre.length !== liste.length) enregistrerManques(propre);
    setManques(propre);
    setProduits(ps || []);
  }, []);

  // Rechargé à chaque page (un stock modifié dans une fiche produit se voit tout de suite).
  useEffect(() => { charger(); }, [charger, pathname]);

  async function enregistrerManques(liste) {
    await supabase.from('shop_settings').upsert({ key: CLE_MANQUES, value: liste, updated_at: new Date().toISOString() });
  }

  async function ajouterStock(p, t) {
    const qte = parseInt(saisies[cleTaille(p.id, t.size)], 10);
    if (!(qte > 0)) return;
    setEnCours(cleTaille(p.id, t.size));
    const { error } = await supabase.from('shop_product_sizes').update({ stock: qte }).eq('id', t.id);
    setEnCours('');
    if (!error) {
      setSaisies(s => ({ ...s, [cleTaille(p.id, t.size)]: '' }));
      charger();
    }
  }

  async function marquerManque(p, t) {
    const liste = [...new Set([...manques, cleTaille(p.id, t.size)])];
    setManques(liste);
    await enregistrerManques(liste);
  }

  const liste = produits ? taillesEpuisees(produits, manques) : [];
  const total = liste.reduce((n, p) => n + p.epuisees.length, 0);
  if (!total) return null;

  return (
    <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 overflow-hidden">
      <button type="button" onClick={() => setOuvert(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-amber-100/60">
        <AlertTriangle size={18} className="text-amber-600 shrink-0" />
        <span className="flex-1 text-sm text-amber-900">
          <b>{total} taille{total > 1 ? 's' : ''} épuisée{total > 1 ? 's' : ''}</b> dans {liste.length} ensemble{liste.length > 1 ? 's' : ''}
          <span className="hidden sm:inline text-amber-700"> — {liste.slice(0, 3).map(p => `${p.name} (${p.epuisees.map(t => t.size).join(', ')})`).join(' · ')}{liste.length > 3 ? '…' : ''}</span>
        </span>
        <span className="text-xs font-semibold text-amber-800 shrink-0">{ouvert ? 'Fermer' : 'Réapprovisionner'}</span>
        <ChevronDown size={16} className={`text-amber-700 transition-transform ${ouvert ? 'rotate-180' : ''}`} />
      </button>

      {ouvert && (
        <div className="border-t border-amber-200 bg-white divide-y divide-gray-100">
          {liste.map(p => {
            const photo = [...(p.images || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0]?.url;
            return (
              <div key={p.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 sm:w-64 shrink-0 min-w-0">
                  {photo ? <img src={miniature(photo)} alt="" className="w-10 h-12 rounded object-cover bg-gray-100" /> : <span className="w-10 h-12 rounded bg-gray-100" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                    <Link to={`/store/produits/${p.id}`} className="text-[11px] text-gray-400 hover:text-gray-700 inline-flex items-center gap-1"><Pencil size={10} /> Fiche produit</Link>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.epuisees.map(t => {
                    const k = cleTaille(p.id, t.size);
                    return (
                      <div key={t.id} className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 pl-2 pr-1 py-1">
                        <span className="text-xs font-bold text-red-700 w-8">{t.size}</span>
                        <input type="number" min={1} inputMode="numeric" placeholder="Qté"
                          value={saisies[k] ?? ''} onChange={e => setSaisies(s => ({ ...s, [k]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') ajouterStock(p, t); }}
                          className="w-14 text-xs border border-gray-200 rounded px-1.5 py-1 bg-white" />
                        <button type="button" onClick={() => ajouterStock(p, t)} disabled={!(parseInt(saisies[k], 10) > 0) || enCours === k}
                          title="Ajouter ce stock" className="p-1 rounded bg-green-600 text-white disabled:opacity-30 hover:bg-green-700">
                          <Plus size={13} />
                        </button>
                        <button type="button" onClick={() => marquerManque(p, t)}
                          title="Manque de stock : pas de réassort prévu, ne plus alerter"
                          className="flex items-center gap-1 px-1.5 py-1 rounded text-[11px] text-gray-600 hover:bg-gray-200">
                          <Ban size={12} /> Manque
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <p className="px-4 py-2 text-[11px] text-gray-400">
            « Manque » : la taille reste affichée « épuisée » sur le site mais ne déclenche plus d'alerte, jusqu'à ce qu'elle soit réapprovisionnée.
          </p>
        </div>
      )}
    </div>
  );
}
