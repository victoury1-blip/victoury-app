import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Ruler } from 'lucide-react';
import { useLang } from '../lib/i18n';
import { grilleEffective, suggererTaille, tailleProduitCorrespondante, normaliserTaille } from '../lib/guideTailles';

/* Fenêtre « Guide des tailles » : calculatrice (poids + taille → taille
   conseillée, un clic la sélectionne) puis le tableau des mesures. La photo
   déposée dans /store/theme, si l'admin en a mis une, s'affiche en dessous. */
export default function GuideTailles({ onFermer, tailles, onChoisir, imageAdmin, grille }) {
  const GRILLE = grilleEffective(grille);
  const { lang } = useLang();
  const ar = lang === 'ar';
  const [poids, setPoids] = useState('');
  const [hauteur, setHauteur] = useState('');
  const sugg = poids ? suggererTaille(poids, hauteur, GRILLE) : null;
  const dispo = sugg ? tailleProduitCorrespondante(tailles, sugg.taille) : null;
  const stockDispo = dispo ? (tailles.find(s => s.size === dispo)?.stock > 0) : false;
  const suivante = sugg?.bord ? GRILLE[sugg.index + 1]?.taille : null;
  const plage = (v) => (Array.isArray(v) ? `${v[0]}–${v[1]}` : '—');

  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onFermer}>
      <div dir={ar ? 'rtl' : 'ltr'} onClick={e => e.stopPropagation()}
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Ruler size={16} /> {ar ? 'دليل المقاسات' : 'Guide des tailles'}</h2>
          <button onClick={onFermer} aria-label="Fermer" className="p-1.5 rounded hover:bg-gray-100"><X size={16} className="text-gray-400" /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* Calculatrice */}
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
            <p className="text-[13px] font-medium mb-2">{ar ? 'شنو هو المقاس ديالي؟ 🤔' : 'Quelle est ma taille ? 🤔'}</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] text-gray-500">
                {ar ? 'الوزن (كلغ)' : 'Poids (kg)'}
                <input type="number" inputMode="numeric" value={poids} onChange={e => setPoids(e.target.value)} placeholder="60"
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-base text-ink bg-white" />
              </label>
              <label className="text-[11px] text-gray-500">
                {ar ? 'الطول (سم)' : 'Taille (cm)'}
                <input type="number" inputMode="numeric" value={hauteur} onChange={e => setHauteur(e.target.value)} placeholder="160"
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-base text-ink bg-white" />
              </label>
            </div>
            {poids && !sugg && (
              <p className="mt-2 text-xs text-red-600">{ar ? 'دخلي وزن صحيح بالكيلو' : 'Entrez un poids valide en kg'}</p>
            )}
            {sugg && (
              <div className="mt-3 rounded-lg bg-white border border-emerald-200 p-3">
                <p className="text-sm">
                  {ar ? 'المقاس المناسب ليك:' : 'Taille conseillée :'}{' '}
                  <span className="text-lg font-bold text-emerald-700">{sugg.taille}</span>
                </p>
                {suivante && (
                  <p className="text-[11px] text-gray-500 mt-1">
                    {ar ? `إلا كتبغي اللبسة واسعة شوية، ختاري ${suivante}` : `Si vous aimez plus ample, prenez ${suivante}`}
                  </p>
                )}
                {dispo && stockDispo && onChoisir && (
                  <button type="button" onClick={() => { onChoisir(dispo); onFermer(); }}
                    className="mt-2 w-full bg-ink text-white text-sm font-medium py-2.5 rounded-lg">
                    {ar ? `ختاري ${dispo}` : `Choisir ${dispo}`}
                  </button>
                )}
                {(!dispo || !stockDispo) && (
                  <p className="mt-2 text-[11px] text-amber-700">
                    {ar ? 'هاد المقاس ما متوفرش دابا فهاد المنتوج' : "Cette taille n'est pas disponible pour ce produit"}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Tableau */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-[12px] text-center">
              <thead className="bg-gray-100 text-gray-600">
                <tr>
                  <th className="py-2 px-1">{ar ? 'المقاس' : 'Taille'}</th>
                  <th className="py-2 px-1">{ar ? 'الوزن (كلغ)' : 'Poids (kg)'}</th>
                  <th className="py-2 px-1">{ar ? 'الصدر' : 'Poitrine'}</th>
                  <th className="py-2 px-1">{ar ? 'الخصر' : 'Tour taille'}</th>
                  <th className="py-2 px-1">{ar ? 'الأرداف' : 'Hanches'}</th>
                </tr>
              </thead>
              <tbody>
                {GRILLE.map((g, i) => {
                  const actif = sugg?.taille === g.taille;
                  const auProduit = (tailles || []).some(s => normaliserTaille(s.size) === g.taille);
                  return (
                    <tr key={g.taille} className={actif ? 'bg-emerald-50 font-semibold' : i % 2 ? 'bg-gray-50' : 'bg-white'}>
                      <td className={`py-2 px-1 font-bold ${auProduit ? 'text-ink' : 'text-gray-300'}`}>{g.taille}</td>
                      <td dir="ltr" className="py-2 px-1">{plage(g.poids)}</td>
                      <td dir="ltr" className="py-2 px-1">{plage(g.poitrine)}</td>
                      <td dir="ltr" className="py-2 px-1">{plage(g.tourTaille)}</td>
                      <td dir="ltr" className="py-2 px-1">{plage(g.hanches)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-[10px] text-gray-400 px-2 py-1.5 bg-gray-50 border-t border-gray-100">
              {ar ? 'القياسات بالسنتيمتر (سم)' : 'Mesures du corps en centimètres (cm)'}
            </p>
          </div>

          <ul className="text-[12px] text-gray-600 space-y-1.5">
            <li>✨ {ar ? 'الثوب مطاطي (élastique) وكيتمدد مع الجسم.' : 'Tissu élastique : il épouse le corps.'}</li>
            <li>📏 {ar ? 'إلا كنتي بين جوج مقاسات: الصغير إلا بغيتيها مزيرة، والكبير إلا بغيتيها مرتاحة.' : 'Entre deux tailles : la plus petite pour un effet ajusté, la plus grande pour plus de confort.'}</li>
            <li>💬 {ar ? 'ما متأكداش؟ كتبي لينا فالواتساب ونعاونوك.' : 'Un doute ? Écrivez-nous sur WhatsApp.'}</li>
          </ul>

          {imageAdmin && <img src={imageAdmin} alt={ar ? 'دليل المقاسات' : 'Guide des tailles'} className="w-full h-auto rounded-lg" />}
        </div>
      </div>
    </div>,
    document.body,
  );
}
