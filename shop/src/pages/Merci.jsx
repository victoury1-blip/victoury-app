import React, { useState } from 'react';
import { avisCommandeActif } from '../lib/avisCommande';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { fmtPrix } from '../lib/pricing';
import { useLang } from '../lib/i18n';
import { miniature, surErreurMiniature } from '../lib/img';
import { normaliserTelephone, numeroWhatsApp } from '../lib/commande';

/* Reçu de commande complet (coordonnées + articles + total), transmis
   depuis Commander.jsx au moment de la validation — la commande n'existe
   nulle part ailleurs côté client une fois le panier vidé, et re-demander
   la commande à Supabase par son id public exposerait celle de n'importe
   quel client à qui devine/partage son numéro. Un accès direct à cette
   page (lien rouvert, page rafraîchie) retombe donc sur le message générique
   d'origine, sans détail. */
export default function Merci({ reglages }) {
  const { id } = useParams();
  const { state } = useLocation();
  const { t, lang } = useLang();
  const ar = lang === 'ar';
  const avis = avisCommandeActif(reglages?.avisCommande);
  const [fenetre, setFenetre] = useState(true);
  const texte = avis && (ar ? avis.texteAr : avis.texteFr);
  const encart = avis && (
    <div dir={ar ? 'rtl' : 'ltr'} className="mt-6 text-center rounded-2xl border border-pink-200 border-s-4 border-s-pink-400 bg-gradient-to-br from-pink-50 to-rose-50 shadow-sm shadow-pink-100 px-4 py-3 text-sm font-medium text-pink-900 leading-relaxed">
      {texte}
    </div>
  );
  /* Fenêtre douce juste après la validation : la cliente la voit avant de
     quitter le site, sans l'avoir vue avant de commander. */
  const popup = avis && fenetre && (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center px-6" onClick={() => setFenetre(false)}>
      <div dir={ar ? 'rtl' : 'ltr'} onClick={e => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-gradient-to-br from-pink-50 to-rose-50 border border-pink-200 shadow-xl px-6 py-6 text-center">
        <div className="w-12 h-12 rounded-full bg-green-600 text-white grid place-items-center mx-auto"><Check size={22} /></div>
        <p className="mt-3 text-sm font-semibold text-gray-900">{ar ? 'تم تسجيل طلبك بنجاح 🎉' : 'Commande bien enregistrée 🎉'}</p>
        <p className="mt-3 text-sm font-medium text-pink-900 leading-relaxed">{texte}</p>
        <button type="button" onClick={() => setFenetre(false)}
          className="mt-5 w-full rounded-xl bg-pink-500 hover:bg-pink-600 text-white py-3 text-sm font-semibold">
          {ar ? 'مفهوم ❤️' : 'Compris ❤️'}
        </button>
      </div>
    </div>
  );

  if (!state) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        {popup}
        <div className="w-14 h-14 rounded-full bg-green-600 text-white grid place-items-center mx-auto"><Check size={26} /></div>
        <h1 className="mt-6 text-lg tracking-[0.2em] uppercase">{ar ? 'تم تسجيل الطلب' : 'Commande enregistrée'}</h1>
        <p className="mt-3 text-sm text-gray-600">
          {ar ? 'شكرًا لكم! سنتصل بكم قريبًا لتأكيد طلبكم.' : 'Merci ! Nous vous appelons très vite pour confirmer votre commande.'}
        </p>
        {id && <p className="mt-4 text-xs text-gray-400">{t('numeroCommande')} : <span className="font-mono">{id}</span></p>}
        {encart}
        <Link to="/" className="inline-block mt-8 border border-ink px-8 py-3 text-[11px] tracking-widest uppercase">
          {t('retourBoutique')}
        </Link>
      </div>
    );
  }

  const { form, lignes, total } = state;

  /* « Confirmer sur WhatsApp » : la cliente envoie elle-même le récapitulatif
     au numéro de la boutique — commande confirmée sans attendre l'appel. */
  const waBoutique = numeroWhatsApp(reglages?.theme?.footer?.contacts?.whatsapp);
  const messageWa = [
    `السلام عليكم، بغيت نأكد الكوموند ديالي ✅`,
    id ? `رقم الطلب: ${id}` : '',
    ...lignes.map(l => `• ${l.name}${l.size ? ` — ${l.size}` : ''}${l.color ? ` — ${l.color}` : ''} × ${l.qty}`),
    `المجموع: ${fmtPrix(total, 'ar')}`,
    `الاسم: ${form.nom}`,
    `الهاتف: ${normaliserTelephone(form.telephone)}`,
    `المدينة: ${form.ville}`,
    `العنوان: ${form.adresse}`,
  ].filter(Boolean).join('\n');
  const lienWa = waBoutique ? `https://wa.me/${waBoutique}?text=${encodeURIComponent(messageWa)}` : '';
  const boutonWa = lienWa && (
    <a href={lienWa} target="_blank" rel="noreferrer"
      className="mt-6 flex items-center justify-center gap-2 w-full rounded-xl bg-[#25D366] hover:bg-[#1ebe5b] text-white py-4 px-4 text-sm font-bold shadow-sm">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4C2.7 15.6 2.2 13.8 2.2 12 2.2 6.6 6.6 2.2 12 2.2S21.8 6.6 21.8 12 17.4 21.8 12 21.8zM12 0C5.4 0 0 5.4 0 12c0 2.1.6 4.2 1.6 6L0 24l6.2-1.6c1.8 1 3.8 1.5 5.8 1.5 6.6 0 12-5.4 12-12S18.6 0 12 0z"/></svg>
      {ar ? 'أكّدي الطلب ديالك فالواتساب' : 'Confirmer ma commande sur WhatsApp'}
    </a>
  );

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      {popup}
      <div className="text-center">
        <div className="w-14 h-14 rounded-full bg-green-600 text-white grid place-items-center mx-auto"><Check size={26} /></div>
        <h1 className="mt-6 text-lg tracking-[0.2em] uppercase">{ar ? 'تم تأكيد الطلب' : 'Commande confirmée'}</h1>
        {id && <p className="mt-1 text-xs text-gray-400 font-mono">{ar ? 'رقم' : 'Numéro'} #{id}</p>}
        {boutonWa}
        {boutonWa && <p className="mt-2 text-[11px] text-gray-400">{ar ? 'ضغطي باش تأكدي دابا، بلا ما تستناي المكالمة' : 'Confirmez maintenant, sans attendre notre appel'}</p>}
        {encart}
      </div>

      <div className="mt-8 border-t border-gray-100 pt-5">
        <h2 className="text-[11px] tracking-widest uppercase text-gray-400">
          {ar ? 'معلومات التوصيل' : 'Coordonnées de livraison'}
        </h2>
        {/* dir="rtl" en arabe : sans lui, le libellé arabe (première case du
            flex) restait affiché à gauche par défaut du navigateur, alors
            que la lecture arabe attend le libellé à droite et la valeur
            (souvent un nom saisi en alphabet latin) à gauche. */}
        <dl className="mt-3 space-y-2 text-sm" dir={ar ? 'rtl' : 'ltr'}>
          {[
            [ar ? 'الاسم' : 'Nom', form.nom],
            [ar ? 'الهاتف' : 'Téléphone', normaliserTelephone(form.telephone) || form.telephone],
            [ar ? 'المدينة' : 'Ville', form.ville],
            [ar ? 'العنوان' : 'Adresse', form.adresse],
          ].filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-gray-400 shrink-0">{k}</dt>
              <dd className="text-gray-800 text-left" dir="auto">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-8 border-t border-gray-100 pt-5">
        <h2 className="text-[11px] tracking-widest uppercase text-gray-400">
          {ar ? 'تفاصيل الطلب' : 'Détails de la commande'}
        </h2>
        <div className="mt-3 divide-y divide-gray-50">
          {lignes.map(l => (
            <div key={`${l.slug}::${l.size || ''}`} className="flex items-center gap-3 py-3">
              <div className="w-14 h-16 bg-sand shrink-0 overflow-hidden rounded">
                {l.image && <img src={miniature(l.image)} onError={(e) => surErreurMiniature(e, l.image)} alt="" loading="lazy" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 truncate">{l.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {[l.size, l.color].filter(Boolean).join(' · ')} {ar ? '· الكمية' : '· Qté'} : {l.qty}
                </p>
              </div>
              <span className="text-sm font-medium text-gray-800 shrink-0">{fmtPrix(l.price * l.qty, lang)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100 text-sm font-semibold">
          <span>{ar ? 'المجموع' : 'Total'}</span>
          <span>{fmtPrix(total, lang)}</span>
        </div>
      </div>

      <Link to="/" className="mt-10 block w-full text-center bg-ink text-white py-4 text-xs tracking-widest uppercase">
        {ar ? 'متابعة التسوق' : 'Continuer mes achats'}
      </Link>
    </div>
  );
}
