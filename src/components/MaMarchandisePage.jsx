import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Truck, XCircle, Ban, Warehouse, AlertOctagon, Pencil, Check, Boxes } from 'lucide-react';
import { inventaire, valeurs, PRIX_ACHAT } from '../lib/inventaire';
import { lireRecuIdsLocal } from '../lib/colisRetours';
import { chargerStockManuel, lireStockManuelCache } from '../lib/stockManuel';
import { cloudGet, cloudSet, localGet } from '../lib/cloudSettings';

/* « Ma marchandise » : où est chaque pièce et ce qu'elle vaut (prix d'achat) —
 * expédiées, annulées / retours à récupérer, stock au local, défectueuses.
 * Les colis livrés n'y figurent pas : ils ne sont plus de la marchandise. */

const CLE_DEFAUT = 'stock_defectueux';
const LIBELLE_STATUT = { expedier: 'Expédié', recu_livreur: 'Reçu par livreur', att_ramassage: 'Attente ramassage', pas_rep_lv: 'Pas de réponse LV', en_suivi: 'En suivi' };
const fmt = (n) => Math.round(Number(n || 0)).toLocaleString('fr-FR');
const PRIX_MOYEN = Math.round((PRIX_ACHAT['ensemble sport'] + PRIX_ACHAT['ensemble hijab sport']) / 2);

function Carte({ icon: Icon, titre, pieces, dh, sous, cls, children }) {
  return (
    <div className={`rounded-2xl border p-4 min-w-0 ${cls}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide opacity-80">
        <Icon size={15} className="shrink-0" /> <span className="truncate">{titre}</span>
      </div>
      {pieces != null && <div className="mt-2 text-3xl font-black tabular-nums leading-tight">{fmt(pieces)} <span className="text-sm font-semibold opacity-70">pièces</span></div>}
      {dh != null && <div className={`${pieces != null ? 'mt-0.5 text-sm' : 'mt-2 text-3xl'} font-bold tabular-nums`}>≈ {fmt(dh)} DH</div>}
      {sous && <div className="text-xs opacity-75 mt-1">{sous}</div>}
      {children}
    </div>
  );
}

export default function MaMarchandisePage({ orders }) {
  const recuIds = useMemo(() => lireRecuIdsLocal(), []);
  const [stockLocal, setStockLocal] = useState(lireStockManuelCache);
  const [defauts, setDefauts] = useState(() => { const v = localGet(CLE_DEFAUT); return typeof v === 'number' ? v : 0; });
  const [saisie, setSaisie] = useState(null);

  useEffect(() => {
    chargerStockManuel().then(setStockLocal).catch(() => {});
    cloudGet(CLE_DEFAUT).then(v => { if (typeof v === 'number') setDefauts(v); }).catch(() => {});
  }, []);

  const p = useMemo(() => inventaire(orders, recuIds), [orders, recuIds]);
  const v = useMemo(() => valeurs(orders, recuIds, PRIX_MOYEN), [orders, recuIds]);

  const totalPieces = p.enLivraison.pieces + p.aRecuperer + stockLocal + defauts;
  const valeurLocal = stockLocal * PRIX_MOYEN;
  const valeurDefauts = defauts * PRIX_MOYEN;
  const valeurMarchandise = v.livreur.achat + v.aRecuperer.achat + valeurLocal; // les défectueuses ne valent plus rien à la vente

  async function enregistrerDefauts() {
    const n = Math.max(0, parseInt(saisie, 10) || 0);
    setDefauts(n); setSaisie(null);
    await cloudSet(CLE_DEFAUT, n);
  }

  return (
    <div className="p-4 sm:p-6 page-enter max-w-6xl">
      <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Boxes className="text-indigo-600" size={22} /> Ma marchandise</h1>
      <p className="text-sm text-gray-500 mt-1">Où sont mes pièces et ce qu'elles valent : expédiées, annulées, retours, stock au local et défectueuses.</p>

      {/* Résumé */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-2xl bg-gray-900 text-white p-5">
          <div className="text-xs uppercase tracking-wide text-white/60 font-semibold">Total marchandise</div>
          <div className="mt-1 text-3xl font-black tabular-nums">{fmt(totalPieces)} <span className="text-base font-semibold text-white/60">pièces</span></div>
          <div className="text-xs text-white/60 mt-1">livreur + à récupérer + local + défectueux</div>
        </div>
        <div className="rounded-2xl bg-indigo-600 text-white p-5">
          <div className="text-xs uppercase tracking-wide text-white/70 font-semibold">Valeur de la marchandise (prix d'achat)</div>
          <div className="mt-1 text-3xl font-black tabular-nums">≈ {fmt(valeurMarchandise)} DH</div>
          <div className="text-xs text-white/70 mt-1">hors défectueuses</div>
        </div>
      </div>

      {/* Détail */}
      <h2 className="mt-8 text-sm font-bold text-gray-700">Où sont les pièces</h2>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Carte icon={Truck} titre="Expédiés (chez le livreur)" pieces={p.enLivraison.pieces} dh={v.livreur.achat}
          sous={`${p.enLivraison.colis} colis · ${fmt(v.livreur.vente)} DH à encaisser s'ils sont livrés`}
          cls="bg-sky-50 border-sky-200 text-sky-900">
          {/* Même découpage que les filtres de la Liste des Colis, pour comparer. */}
          <div className="mt-2 flex flex-wrap gap-1">
            {Object.entries(p.enLivraison.parStatut).sort((a, b) => b[1] - a[1]).map(([st, n]) => (
              <span key={st} className="text-[11px] bg-white/70 border border-sky-200 rounded-full px-2 py-0.5">
                {LIBELLE_STATUT[st] || st} <b>{n}</b>
              </span>
            ))}
          </div>
          {p.enLivraison.anciensIgnores > 0 && (
            <div className="mt-1.5 text-[11px] opacity-70">{p.enLivraison.anciensIgnores} ancien(s) colis ignoré(s) : même statut depuis plus de 45 jours</div>
          )}
        </Carte>
        <Carte icon={XCircle} titre="Retours à récupérer" pieces={p.refuses.aRecuperer + p.echanges.aRecuperer} dh={v.aRecuperer.retours}
          sous={`refusés${p.echanges.aRecuperer ? ` + ${fmt(p.echanges.aRecuperer)} d'échanges` : ''} · ${fmt(p.refuses.recus + p.echanges.recus)} déjà rentrées au local`} cls="bg-red-50 border-red-200 text-red-800" />
        <Carte icon={Ban} titre="Annulés à récupérer" pieces={p.annules.aRecuperer} dh={v.aRecuperer.annules}
          sous={`${fmt(p.annules.recus)} pièces déjà rentrées au local`} cls="bg-orange-50 border-orange-200 text-orange-800" />
        <Carte icon={Warehouse} titre="Stock au local" pieces={stockLocal} dh={valeurLocal}
          cls="bg-indigo-50 border-indigo-200 text-indigo-900">
          <Link to="/stock" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:underline"><Pencil size={11} /> Régler dans Stock</Link>
        </Carte>
        <Carte icon={AlertOctagon} titre="Défectueux" pieces={saisie === null ? defauts : null} dh={saisie === null ? valeurDefauts : null}
          sous={saisie === null ? 'abîmés / invendables (valeur perdue)' : undefined} cls="bg-gray-50 border-gray-200 text-gray-800">
          {saisie === null ? (
            <button type="button" onClick={() => setSaisie(String(defauts))} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-900">
              <Pencil size={11} /> Modifier
            </button>
          ) : (
            <div className="mt-2 flex items-center gap-1.5">
              <input autoFocus type="number" min={0} value={saisie} onChange={e => setSaisie(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') enregistrerDefauts(); if (e.key === 'Escape') setSaisie(null); }}
                className="w-24 text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white" />
              <button type="button" onClick={enregistrerDefauts} className="p-2 rounded-lg bg-gray-800 text-white"><Check size={14} /></button>
            </div>
          )}
        </Carte>
      </div>

      <p className="mt-6 text-xs text-gray-400 leading-relaxed">
        Valeur d'achat : Ensemble Sport {PRIX_ACHAT['ensemble sport']} DH, Ensemble Hijab Sport {PRIX_ACHAT['ensemble hijab sport']} DH la pièce
        (stock au local et défectueux au prix moyen {PRIX_MOYEN} DH). Les retours déjà rentrés sont supposés comptés dans le stock au local.
      </p>
    </div>
  );
}
