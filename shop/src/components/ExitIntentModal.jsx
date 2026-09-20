import React from 'react';
import { X } from 'lucide-react';
import { IconeWhatsApp } from './icons';
import { numeroWhatsApp } from '../lib/commande';
import { useLang } from '../lib/i18n';

/* Le client marocain hésite souvent en silence plutôt que d'écrire — il
   quitte la page sans jamais dire pourquoi (taille, délai, une question sur
   le produit). Ce popup n'intercepte QUE le bouton/geste "retour" du
   téléphone ou du navigateur : le bouton "X" propre au navigateur intégré
   d'Instagram/TikTok appartient à leur application, aucun site web ne peut
   l'intercepter — seul ce cas-là reste hors de portée. */
export default function ExitIntentModal({ ouvert, onFermer, numero }) {
  const { lang } = useLang();
  const ar = lang === 'ar';
  const digits = numeroWhatsApp(numero);
  if (!ouvert || !digits) return null;

  const texte = ar
    ? 'السلام، كنت كنشوف فـ Victoury وعندي سؤال قبل ما نطلب...'
    : "Bonjour, j'étais sur Victoury et j'ai une question avant de commander...";
  const href = `https://wa.me/${digits}?text=${encodeURIComponent(texte)}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={onFermer}>
      <div onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl max-w-sm w-full p-6 text-center relative shadow-xl">
        <button type="button" onClick={onFermer} aria-label={ar ? 'إغلاق' : 'Fermer'}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>
        <div className="mx-auto w-14 h-14 rounded-full bg-[#25D366]/10 grid place-items-center">
          <IconeWhatsApp size={28} className="text-[#25D366]" />
        </div>
        <p className="mt-4 text-base font-semibold text-ink" dir={ar ? 'rtl' : 'ltr'}>
          {ar ? 'قبل ما تسالي... 👋' : 'Avant de partir... 👋'}
        </p>
        <p className="mt-2 text-sm text-gray-500" dir={ar ? 'rtl' : 'ltr'}>
          {ar
            ? 'عندك سؤال على المقاس، التوصيل، ولا شي منتوج؟ صيفط لينا فـ WhatsApp، كنجاوبو بسرعة.'
            : 'Une question sur une taille, la livraison ou un produit ? Écrivez-nous sur WhatsApp, on répond vite.'}
        </p>
        <a href={href} target="_blank" rel="noreferrer" onClick={onFermer}
          className="mt-5 flex items-center justify-center gap-2 bg-[#25D366] text-white rounded-full py-3 px-5 font-medium hover:brightness-95 transition-all">
          <IconeWhatsApp size={18} />
          {ar ? 'تواصل معانا فـ WhatsApp' : 'Nous écrire sur WhatsApp'}
        </a>
      </div>
    </div>
  );
}
