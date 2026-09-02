import React from 'react';
import { IconeWhatsApp } from './icons';
import { numeroWhatsApp } from '../lib/commande';

/* Bulle flottante visible sur toutes les pages de la vitrine — le client
   marocain écrit d'abord sur WhatsApp avant de commander, bien plus que par
   e-mail. N'apparaît que si un numéro VALIDE est réglé (/store/theme →
   Footer), jamais un lien mort ("numéro non valide"). */
export default function WhatsAppBulle({ numero }) {
  const digits = numeroWhatsApp(numero);
  if (!digits) return null;
  const href = `https://wa.me/${digits}?text=${encodeURIComponent('السلام، بغيت نسولك على...')}`;

  return (
    <a href={href} target="_blank" rel="noreferrer"
      className="fixed bottom-5 right-5 z-30 flex items-center gap-2 bg-[#25D366] text-white rounded-full shadow-lg
                 px-4 py-3 hover:brightness-95 transition-all">
      <IconeWhatsApp size={20} />
      <span dir="rtl" lang="ar" className="text-sm font-medium whitespace-nowrap">تواصل معانا</span>
    </a>
  );
}
