import React from 'react';
import { IconeWhatsApp } from './icons';
import { numeroWhatsApp } from '../lib/commande';
import { useLang } from '../lib/i18n';

/* Bulle flottante visible sur toutes les pages de la vitrine — le client
   marocain écrit d'abord sur WhatsApp avant de commander, bien plus que par
   e-mail. N'apparaît que si un numéro VALIDE est réglé (/store/theme →
   Footer), jamais un lien mort ("numéro non valide"). Le texte suit la
   langue choisie (avant : toujours en arabe, même en français) — et un
   léger rebond continu attire l'œil vers elle plutôt que de compter sur le
   client pour la remarquer tout seul en bas de l'écran. */
export default function WhatsAppBulle({ numero }) {
  const { lang } = useLang();
  const ar = lang === 'ar';
  const digits = numeroWhatsApp(numero);
  if (!digits) return null;
  const message = ar ? 'السلام، بغيت نسولك على...' : "Bonjour, j'ai une question sur...";
  const href = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;

  return (
    <a href={href} target="_blank" rel="noreferrer"
      className="fixed bottom-5 right-5 z-30 flex items-center gap-2 bg-[#25D366] text-white rounded-full shadow-lg
                 px-4 py-3 hover:brightness-95 transition-all animate-bounce">
      <IconeWhatsApp size={20} />
      <span dir={ar ? 'rtl' : 'ltr'} className="text-sm font-medium whitespace-nowrap">
        {ar ? 'تواصل معانا' : 'Contactez-nous'}
      </span>
    </a>
  );
}
