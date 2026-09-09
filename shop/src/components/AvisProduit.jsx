import React, { useEffect, useState } from 'react';
import { Star, BadgeCheck } from 'lucide-react';
import { chargerAvisProduit, chargerResumeAvis, soumettreAvis } from '../lib/reviews';
import { useLang } from '../lib/i18n';

function Etoiles({ valeur, taille = 14, onChange }) {
  const interactif = !!onChange;
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" disabled={!interactif} onClick={() => onChange?.(n)}
          className={interactif ? 'cursor-pointer' : 'cursor-default'} aria-label={interactif ? `${n} étoiles` : undefined}>
          <Star size={taille} className={n <= Math.round(valeur) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
        </button>
      ))}
    </div>
  );
}

/** Résumé "4.6 ★ (23 avis)" — utilisable seul (fiche produit, carte de
    grille) sans charger la liste complète des avis. `taille`/`className`
    réglables pour tenir dans une carte plus petite que la fiche produit. */
export function ResumeAvis({ productId, taille = 14, className = 'mt-2' }) {
  const [resume, setResume] = useState(null);
  useEffect(() => { let vif = true; chargerResumeAvis(productId).then(r => { if (vif) setResume(r); }); return () => { vif = false; }; }, [productId]);
  if (!resume || resume.total === 0) return null;
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Etoiles valeur={resume.moyenne} taille={taille} />
      <span className="text-xs text-gray-500">{resume.moyenne.toFixed(1)} ({resume.total})</span>
    </div>
  );
}

export default function AvisProduit({ productId }) {
  const { lang } = useLang();
  const ar = lang === 'ar';
  const [avis, setAvis] = useState(null);
  const [formOuvert, setFormOuvert] = useState(false);
  const [note, setNote] = useState(5);
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => { chargerAvisProduit(productId).then(setAvis); }, [productId]);

  async function envoyer(e) {
    e.preventDefault();
    if (!nom.trim()) return;
    setEnvoi(true); setErreur('');
    const r = await soumettreAvis({ productId, rating: note, author: nom, comment: commentaire, telephone });
    setEnvoi(false);
    if (!r.ok) { setErreur(r.error); return; }
    setEnvoye(true);
    setFormOuvert(false);
  }

  return (
    <div className="col-span-full mt-10 border-t border-gray-100 pt-10" dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-sm tracking-[0.2em] uppercase text-gray-500">
          {ar ? 'آراء العملاء' : 'Avis clients'} {avis?.length > 0 && `(${avis.length})`}
        </h2>
        {!formOuvert && !envoye && (
          <button type="button" onClick={() => setFormOuvert(true)} className="text-xs underline text-gray-500 hover:text-ink">
            {ar ? 'اكتب رأيك' : 'Laisser un avis'}
          </button>
        )}
      </div>

      {envoye && (
        <p className="mt-4 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-4 py-3">
          {ar ? 'شكرًا! سيظهر رأيك بعد المراجعة.' : 'Merci ! Votre avis sera visible après vérification.'}
        </p>
      )}

      {formOuvert && (
        <form onSubmit={envoyer} className="mt-5 border border-gray-100 rounded-lg p-4 space-y-3 max-w-md">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">{ar ? 'التقييم' : 'Note'}</label>
            <Etoiles valeur={note} taille={20} onChange={setNote} />
          </div>
          <div>
            <input value={nom} onChange={e => setNom(e.target.value)} placeholder={ar ? 'اسمك' : 'Votre nom'}
              className="w-full border border-gray-200 px-3 py-2 text-sm" required />
          </div>
          <div>
            <input value={telephone} onChange={e => setTelephone(e.target.value)} placeholder={ar ? 'الهاتف (اختياري، لتأكيد الشراء)' : 'Téléphone (facultatif, pour "achat vérifié")'}
              className="w-full border border-gray-200 px-3 py-2 text-sm" dir="ltr" />
          </div>
          <div>
            <textarea value={commentaire} onChange={e => setCommentaire(e.target.value)} rows={3}
              placeholder={ar ? 'رأيك (اختياري)' : 'Votre commentaire (facultatif)'} className="w-full border border-gray-200 px-3 py-2 text-sm" />
          </div>
          {erreur && <p className="text-xs text-red-600">{erreur}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={envoi || !nom.trim()}
              className="bg-ink text-white px-5 py-2.5 text-xs tracking-widest uppercase disabled:bg-gray-200 disabled:text-gray-400">
              {envoi ? '…' : (ar ? 'إرسال' : 'Envoyer')}
            </button>
            <button type="button" onClick={() => setFormOuvert(false)} className="px-5 py-2.5 text-xs tracking-widest uppercase text-gray-500">
              {ar ? 'إلغاء' : 'Annuler'}
            </button>
          </div>
        </form>
      )}

      {avis?.length > 0 && (
        <div className="mt-6 space-y-5 max-w-2xl">
          {avis.map(a => (
            <div key={a.id} className="border-b border-gray-50 pb-5">
              <div className="flex items-center gap-2 flex-wrap">
                <Etoiles valeur={a.rating} />
                <span className="text-sm font-medium">{a.author_name}</span>
                {a.verified_purchase && (
                  <span className="flex items-center gap-1 text-[11px] text-green-700 bg-green-50 border border-green-100 rounded-full px-2 py-0.5">
                    <BadgeCheck size={12} /> {ar ? 'شراء مؤكد' : 'Achat vérifié'}
                  </span>
                )}
              </div>
              {a.comment && <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{a.comment}</p>}
            </div>
          ))}
        </div>
      )}

      {avis?.length === 0 && !formOuvert && !envoye && (
        <p className="mt-4 text-sm text-gray-400">{ar ? 'لا يوجد رأي بعد. كن أول من يكتب رأيه.' : 'Aucun avis pour l\'instant. Soyez le premier à donner votre avis.'}</p>
      )}
    </div>
  );
}
