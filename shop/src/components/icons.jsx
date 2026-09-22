import React from 'react';

/* Glyphes WhatsApp et TikTok : absents de lucide-react, dessinés en SVG
   minimal plutôt que d'ajouter une dépendance pour deux icônes. Partagés
   entre le footer et la bulle de contact flottante. */
export function IconeWhatsApp({ size = 16, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size} {...props}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.29-1.39a9.9 9.9 0 0 0 4.75 1.21h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2Zm5.83 14.02c-.24.68-1.4 1.33-1.93 1.4-.5.08-1.11.11-1.79-.11-.41-.13-.94-.3-1.62-.6-2.85-1.23-4.71-4.1-4.85-4.29-.14-.19-1.16-1.54-1.16-2.94 0-1.4.73-2.08 1-2.37.26-.28.57-.35.76-.35h.55c.18 0 .41-.07.64.49.24.58.81 2 .88 2.14.07.14.12.31.02.5-.09.19-.14.31-.28.47-.14.16-.29.36-.42.48-.14.14-.28.29-.12.56.16.28.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.21 1.37.28.14.44.12.6-.07.16-.19.68-.79.87-1.06.19-.28.37-.23.62-.14.26.09 1.63.77 1.91.91.28.14.47.21.53.33.07.12.07.68-.17 1.36Z" />
    </svg>
  );
}

/* Logo WhatsApp complet (bulle avec la petite pointe en bas à gauche +
   silhouette du combiné) — celui affiché tel quel, sans cercle englobant
   dessiné à côté, pour ressembler exactement au logo officiel (voir la
   bulle flottante WhatsAppBulle). */
export function IconeWhatsAppLogo({ size = 24, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size} {...props}>
      <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929h.003c3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.771-5.767-5.771Zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.199.534 1.286.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86.173.087.274.072.376-.043.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087.159.058 1.011.477 1.185.564.173.087.289.13.332.202.043.072.043.419-.101.824ZM12 2C6.477 2 2 6.477 2 12c0 1.849.505 3.578 1.383 5.06L2 22l5.11-1.34A9.958 9.958 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2Z" />
    </svg>
  );
}

export function IconeTikTok({ size = 16, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size} {...props}>
      <path d="M16.6 2h-3.2v13.7a3.1 3.1 0 1 1-2.2-2.97V9.4a6.3 6.3 0 1 0 5.4 6.24V8.7a7.9 7.9 0 0 0 4.9 1.7V7.2a4.5 4.5 0 0 1-4.9-4.2V2Z" />
    </svg>
  );
}

/* Repères de moyens de paiement — leur silhouette reconnaissable (les deux
   cercles Mastercard, le "P" bleu PayPal), pas une reproduction exacte du
   logo déposé. Sert à indiquer les moyens acceptés, pas à imiter la marque. */
export function IconeVisa({ height = 16, ...props }) {
  return (
    <svg viewBox="0 0 48 16" height={height} width={height * 3} {...props}>
      <text x="0" y="13" fontFamily="Georgia, serif" fontStyle="italic" fontWeight="700" fontSize="15" fill="#1A1F71">VISA</text>
    </svg>
  );
}
export function IconeMastercard({ size = 20, ...props }) {
  return (
    <svg viewBox="0 0 36 22" width={size * 1.6} height={size} {...props}>
      <circle cx="14" cy="11" r="10" fill="#EB001B" />
      <circle cx="22" cy="11" r="10" fill="#F79E1B" fillOpacity="0.9" />
    </svg>
  );
}
export function IconePayPal({ size = 16, ...props }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...props}>
      <path fill="#003087" d="M8.5 20.5 10 6.8h5.4c3 0 4.9 1.6 4.5 4.4-.5 3.3-2.9 5-6 5h-2l-.7 4.3H8.5Z" />
      <path fill="#009cde" d="M6.5 17.5 8 3.8h5.4c3 0 4.9 1.6 4.5 4.4-.5 3.3-2.9 5-6 5h-2l-.7 4.3H6.5Z" />
    </svg>
  );
}

/* Drapeaux du sélecteur de langue (Header) — en SVG plutôt qu'en émoji
   "flag" (🇫🇷🇲🇦) : ces émojis reposent sur une police système qui les
   affiche correctement sur Mac/iPhone, mais Windows n'en a longtemps
   affiché que les deux lettres du pays dans un rectangle noir — un
   drapeau dessiné à la main s'affiche pareil sur tous les systèmes. */
export function DrapeauFrance({ size = 16, ...props }) {
  return (
    <svg viewBox="0 0 3 2" width={size * 1.5} height={size} {...props}>
      <rect width="1" height="2" fill="#002395" />
      <rect x="1" width="1" height="2" fill="#fff" />
      <rect x="2" width="1" height="2" fill="#ED2939" />
    </svg>
  );
}
export function DrapeauMaroc({ size = 16, ...props }) {
  return (
    <svg viewBox="0 0 3 2" width={size * 1.5} height={size} {...props}>
      <rect width="3" height="2" fill="#C1272D" />
      <path fill="none" stroke="#006233" strokeWidth="0.07"
        d="M1.5.5 1.618.838 1.976.846 1.69 1.062 1.794 1.405 1.5 1.2 1.206 1.405 1.31 1.062 1.024.846 1.382.838Z" />
    </svg>
  );
}
