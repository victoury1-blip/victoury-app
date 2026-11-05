import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Truck, XCircle, Ban, Warehouse, AlertOctagon, Pencil, Check, Boxes } from 'lucide-react';
import { inventaire, valeurs, PRIX_ACHAT } from '../lib/inventaire';
import { lireRecuIdsLocal } from '../lib/colisRetours';
import { chargerStockManuel, lireStockManuelCache, chargerStockHijab, lireStockHijabCache, definirStockParModele } from '../lib/stockManuel';
import { cloudGet, cloudSet, localGet } from '../lib/cloudSettings';

/* « Ma marchandise » : où est chaque pièce et ce qu'elle vaut (prix d'achat) —
 * expédiées, annulées / retours à récupérer, stock au local, défectueuses.
 * Les colis livrés n'y figurent pas : ils ne sont plus de la marchandise. */

const CLE_DEFAUT = 'stock_defectueux';          // total (Sport + Hijab)
const CLE_DEFAUT_HIJAB = 'stock_defectueux_hijab'; // dont Hijab
const LIBELLE_STATUT = { expedier: 'Expédié', recu_livreur: 'Reçu par livreur', att_ramassage: 'Attente ramassage', pas_rep_lv: 'Pas de réponse LV', en_suivi: 'En suivi' };
const fmt = (n) => Math.round(Number(n || 0)).toLocaleString('fr-FR');
const PRIX_MOYEN = Math.round((PRIX_ACHAT['ensemble sport'] + PRIX_ACHAT['ensemble hijab sport']) / 2);
const P_SPORT = PRIX_ACHAT['ensemble sport'];
const P_HIJAB = PRIX_ACHAT['ensemble hijab sport'];
const lireNombre = (k) => { const v = localGet(k); return typeof v === 'number' ? v : 0; };

/* Deux lignes Sport / Hijab, chacune à son prix, modifiables sur place. */
function ParModele({ sport, hijab, onEnregistrer, couleur }) {
  const [saisie, setSaisie] = useState(null);
  const valider = async () => {
    await onEnregistrer({ sport: Math.max(0, parseInt(saisie.sport, 10) || 0), hijab: Math.max(0, parseInt(saisie.hijab, 10) || 0) });
    setSaisie(null);
  };
  if (saisie) {
    return (
      <div className="mt-3 space-y-2">
        {[['sport', `Ensemble Sport (${P_SPORT} DH)`], ['hijab', `Ensemble Hijab (${P_HIJAB} DH)`]].map(([k, l]) => (
          <label key={k} className="flex items-center justify-between gap-2 text-xs">
            <span>{l}</span>
            <input type="number" min={0} value={saisie[k]} onChange={e => setSaisie(x => ({ ...x, [k]: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') valider(); if (e.key === 'Escape') setSaisie(null); }}
              className="w-24 text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white text-gray-900" />
          </label>
        ))}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={valider} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold"><Check size={13} /> Enregistrer</button>
          <button type="button" onClick={() => setSaisie(null)} className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-white/60">Annuler</button>
        </div>
      </div>
    );
  }
  return (
    <div className="mt-3">
      <div className="divide-y divide-black/5 text-sm">
        {[['Ensemble Sport', sport, P_SPORT], ['Ensemble Hijab', hijab, P_HIJAB]].map(([l, n, prix]) => (
          <div key={l} className="flex items-center justify-between py-1.5">
            <span>{l}</span>
            <span className="tabular-nums"><b>{fmt(n)}</b> × {prix} = <b>{fmt(n * prix)} DH</b></span>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setSaisie({ sport: String(sport), hijab: String(hijab) })}
        className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold hover:underline ${couleur}`}>
        <Pencil size={11} /> Modifier
      </button>
    </div>
  );
}

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
  const [stockHijab, setStockHijab] = useState(lireStockHijabCache);
  const [defauts, setDefauts] = useState(() => lireNombre(CLE_DEFAUT));
  const [defautsHijab, setDefautsHijab] = useState(() => lireNombre(CLE_DEFAUT_HIJAB));

  useEffect(() => {
    chargerStockManuel().then(setStockLocal).catch(() => {});
    chargerStockHijab().then(setStockHijab).catch(() => {});
    cloudGet(CLE_DEFAUT).then(v => { if (typeof v === 'number') setDefauts(v); }).catch(() => {});
    cloudGet(CLE_DEFAUT_HIJAB).then(v => { if (typeof v === 'number') setDefautsHijab(v); }).catch(() => {});
  }, []);

  // Part Hijab bornée au total ; la part Sport s'en déduit.
  const localHijab = Math.min(stockHijab, stockLocal), localSport = stockLocal - localHijab;
  const defHijab = Math.min(defautsHijab, defauts), defSport = defauts - defHijab;

  const p = useMemo(() => inventaire(orders, recuIds), [orders, recuIds]);
  const v = useMemo(() => valeurs(orders, recuIds, PRIX_MOYEN), [orders, recuIds]);

  const totalPieces = p.enLivraison.pieces + p.aRecuperer + stockLocal + defauts;
  const valeurLocal = localSport * P_SPORT + localHijab * P_HIJAB;
  const valeurDefauts = defSport * P_SPORT + defHijab * P_HIJAB;
  const valeurMarchandise = v.livreur.achat + v.aRecuperer.achat + valeurLocal; // les défectueuses ne valent plus rien à la vente

  async function enregistrerStock({ sport, hijab }) {
    await definirStockParModele({ sport, hijab });
    setStockLocal(sport + hijab); setStockHijab(hijab);
  }
  async function enregistrerDefauts({ sport, hijab }) {
    setDefauts(sport + hijab); setDefautsHijab(hijab);
    await Promise.all([cloudSet(CLE_DEFAUT, sport + hijab), cloudSet(CLE_DEFAUT_HIJAB, hijab)]);
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
          sous="baisse tout seul à chaque commande confirmée" cls="bg-indigo-50 border-indigo-200 text-indigo-900">
          <ParModele sport={localSport} hijab={localHijab} onEnregistrer={enregistrerStock} couleur="text-indigo-700" />
          <Link to="/stock" className="mt-1 block text-[11px] text-indigo-600/70 hover:underline">Le total est aussi visible dans Stock</Link>
        </Carte>
        <Carte icon={AlertOctagon} titre="Défectueux" pieces={defauts} dh={valeurDefauts}
          sous="abîmés / invendables (valeur perdue)" cls="bg-gray-50 border-gray-200 text-gray-800">
          <ParModele sport={defSport} hijab={defHijab} onEnregistrer={enregistrerDefauts} couleur="text-gray-700" />
        </Carte>
      </div>

      <p className="mt-6 text-xs text-gray-400 leading-relaxed">
        Valeur d'achat : Ensemble Sport {P_SPORT} DH, Ensemble Hijab {P_HIJAB} DH la pièce. Une commande confirmée retire ses pièces du stock
        (de la ligne Hijab pour les hijabs). Les retours déjà rentrés sont supposés comptés dans le stock au local.
      </p>
    </div>
  );
}
