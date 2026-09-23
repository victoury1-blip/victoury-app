import React, { useEffect, useRef, useState } from 'react';
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
export default function WhatsAppBulle({ numero, icone }) {
  const { lang } = useLang();
  const ar = lang === 'ar';
  const digits = numeroWhatsApp(numero);
  // La bulle de message n'apparaît qu'après un délai (le temps que le
  // client commence à regarder la page, pas dès l'arrivée) et se cache
  // pendant qu'il scrolle — elle réapparaît une fois le scroll arrêté, pour
  // ne jamais rester plantée devant le contenu qu'il est en train de lire.
  const [messageVisible, setMessageVisible] = useState(false);
  const [enScroll, setEnScroll] = useState(false);
  const timerScroll = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setMessageVisible(true), 2500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    function surScroll() {
      setEnScroll(true);
      clearTimeout(timerScroll.current);
      timerScroll.current = setTimeout(() => setEnScroll(false), 400);
    }
    window.addEventListener('scroll', surScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', surScroll);
      clearTimeout(timerScroll.current);
    };
  }, []);

  if (!digits) return null;
  const message = ar ? 'السلام، بغيت نسولك على...' : "Bonjour, j'ai une question sur...";
  const href = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;

  return (
    <a href={href} target="_blank" rel="noreferrer"
      className="fixed bottom-5 right-5 z-30 flex flex-col items-center gap-1.5">
      {/* Bulle de chat façon "assistant" (Ozzy d'Ozone Express, etc.) : un
          message d'accueil chaleureux avec une petite pointe qui redescend
          vers l'icône, plutôt qu'une simple étiquette "Contactez-nous".
          Apparaît avec un fondu (pas d'un coup) et se cache pendant le
          scroll — voir les effets juste au-dessus. */}
      <span dir={ar ? 'rtl' : 'ltr'}
        className={`relative bg-white text-ink text-xs font-semibold whitespace-nowrap px-3.5 py-2 rounded-2xl shadow-md
                   after:content-[''] after:absolute after:left-1/2 after:-translate-x-1/2 after:-bottom-[5px]
                   after:border-[6px] after:border-transparent after:border-t-white
                   transition-opacity duration-300 ${messageVisible && !enScroll ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {ar ? 'سلام 👋 عندك سؤال؟' : 'Bonjour 👋 une question ?'}
      </span>
      <span className="w-14 h-14 grid place-items-center bg-[#25D366] hover:brightness-95 text-white rounded-full shadow-lg ring-2 ring-white transition-all overflow-hidden">
        {icone ? <img src={icone} alt="" className="w-full h-full object-cover" /> : <IconeWhatsApp size={28} />}
      </span>
    </a>
  );
}
