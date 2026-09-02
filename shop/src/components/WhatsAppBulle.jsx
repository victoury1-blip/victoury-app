import React from 'react';
import { IconeWhatsApp } from './icons';

/* Bulle flottante visible sur toutes les pages de la vitrine — le client
   marocain écrit d'abord sur WhatsApp avant de commander, bien plus que par
   e-mail. N'apparaît que si un numéro est réglé (/store/theme → Footer),
   jamais un lien mort. */
export default function WhatsAppBulle({ numero }) {
  if (!numero) return null;
  const href = `https://wa.me/${numero.replace(/\D/g, '')}?text=${encodeURIComponent('السلام، بغيت نسولك على...')}`;

  return (
    <a href={href} target="_blank" rel="noreferrer"
      className="fixed bottom-5 right-5 z-30 flex items-center gap-2 bg-[#25D366] text-white rounded-full shadow-lg
                 px-4 py-3 hover:brightness-95 transition-all">
      <IconeWhatsApp size={20} />
      <span dir="rtl" lang="ar" className="text-sm font-medium whitespace-nowrap">تواصل معانا</span>
    </a>
  );
}
