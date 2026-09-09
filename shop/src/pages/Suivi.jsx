import React, { useState } from 'react';
import { Search, Check, Package, Truck, Home, XCircle, Clock } from 'lucide-react';
import { fmtPrix } from '../lib/pricing';
import { chercherCommande, etapePublique, libelleEtape, FRISE } from '../lib/suivi';
import { useLang } from '../lib/i18n';

const ICONES = { recue: Package, confirmee: Check, expediee: Truck, livree: Home };

export default function Suivi() {
  const { lang } = useLang();
  const ar = lang === 'ar';
  const [id, setId] = useState('');
  const [telephone, setTelephone] = useState('');
  const [chargement, setChargement] = useState(false);
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState('');

  async function rechercher(e) {
    e.preventDefault();
    if (!id.trim() || !telephone.trim()) return;
    setChargement(true); setErreur(''); setResultat(null);
    const r = await chercherCommande(id, telephone);
    setChargement(false);
    if (!r.ok) { setErreur(r.error); return; }
    setResultat(r.commande);
  }

  const etape = resultat ? etapePublique(resultat.status) : null;
  // Annulée/reportée/retournée : pas de place dans la frise linéaire
  // (Reçue → Confirmée → Expédiée → Livrée), affichées à part avec leur
  // propre message plutôt que de forcer une étape qui n'a pas de sens ici.
  const horsFrise = etape && !FRISE.includes(etape);
  const indexAtteint = etape ? FRISE.indexOf(etape) : -1;

  return (
    <div className="max-w-xl mx-auto px-6 py-16" dir={ar ? 'rtl' : 'ltr'}>
      <div className="text-center">
        <h1 className="text-lg tracking-[0.2em] uppercase">{ar ? 'تتبع طلبكم' : 'Suivre ma commande'}</h1>
        <p className="mt-3 text-sm text-gray-500">
          {ar ? 'أدخلوا رقم الطلب ورقم الهاتف المستعمل عند الطلب.' : 'Saisissez votre numéro de commande et le téléphone utilisé lors de la commande.'}
        </p>
      </div>

      <form onSubmit={rechercher} className="mt-8 space-y-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">{ar ? 'رقم الطلب' : 'N° de commande'}</label>
          <input value={id} onChange={e => setId(e.target.value)} placeholder="VS-030926-093712"
            className="w-full border border-gray-200 px-3 py-2.5 text-sm bg-white font-mono" dir="ltr" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">{ar ? 'الهاتف' : 'Téléphone'}</label>
          <input value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="06XXXXXXXX"
            className="w-full border border-gray-200 px-3 py-2.5 text-sm bg-white" dir="ltr" />
        </div>
        <button type="submit" disabled={chargement || !id.trim() || !telephone.trim()}
          className="w-full bg-ink text-white py-3.5 text-xs tracking-widest uppercase flex items-center justify-center gap-2
                     disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
          <Search size={14} /> {chargement ? (ar ? 'جارٍ البحث…' : 'Recherche…') : (ar ? 'بحث' : 'Rechercher')}
        </button>
      </form>

      {erreur && (
        <p className="mt-5 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{erreur}</p>
      )}

      {resultat && (
        <div className="mt-8 border-t border-gray-100 pt-6">
          <p className="text-xs text-gray-400 font-mono" dir="ltr">#{resultat.id}</p>
          <p className="mt-1 text-xs text-gray-400">{resultat.dateAdded} · {resultat.ville}</p>

          {horsFrise ? (
            <div className={`mt-5 rounded-lg px-4 py-3.5 flex items-center gap-3 ${
              etape === 'annulee' ? 'bg-red-50 border border-red-100' : 'bg-amber-50 border border-amber-100'
            }`}>
              {etape === 'annulee' ? <XCircle size={18} className="text-red-500 shrink-0" /> : <Clock size={18} className="text-amber-500 shrink-0" />}
              <div>
                <p className="text-sm font-medium">{libelleEtape(etape, lang)}</p>
                {etape === 'reportee' && resultat.reportDate && (
                  <p className="text-xs text-gray-500 mt-0.5">{ar ? 'التاريخ الجديد:' : 'Nouvelle date :'} {resultat.reportDate}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-6 flex items-center">
              {FRISE.map((e, i) => {
                const Icone = ICONES[e];
                const atteinte = i <= indexAtteint;
                return (
                  <React.Fragment key={e}>
                    {i > 0 && <div className={`flex-1 h-0.5 ${atteinte ? 'bg-ink' : 'bg-gray-200'}`} />}
                    <div className="flex flex-col items-center gap-1.5 shrink-0">
                      <div className={`w-8 h-8 rounded-full grid place-items-center border-2 ${
                        atteinte ? 'bg-ink border-ink text-white' : 'bg-white border-gray-200 text-gray-300'
                      }`}>
                        <Icone size={14} />
                      </div>
                      <span className={`text-[10px] text-center max-w-[4.5rem] ${atteinte ? 'text-ink font-medium' : 'text-gray-400'}`}>
                        {libelleEtape(e, lang)}
                      </span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}

          {resultat.trackingNumber && (
            <p className="mt-5 text-xs text-gray-500">
              {ar ? 'رقم التتبع لدى شركة التوصيل:' : 'N° de suivi transporteur :'} <span className="font-mono" dir="ltr">{resultat.trackingNumber}</span>
            </p>
          )}

          <div className="mt-6 border-t border-gray-100 pt-4">
            {(resultat.products || []).map((p, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1">
                <span className="text-gray-600">{p.name}{p.size ? ` · ${p.size}` : ''} {p.qty > 1 ? `×${p.qty}` : ''}</span>
              </div>
            ))}
            <div className="flex items-center justify-between text-sm font-semibold mt-2 pt-2 border-t border-gray-100">
              <span>{ar ? 'المجموع' : 'Total'}</span>
              <bdi>{fmtPrix(resultat.price, lang)}</bdi>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
