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

export function IconeTikTok({ size = 16, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size} {...props}>
      <path d="M16.6 2h-3.2v13.7a3.1 3.1 0 1 1-2.2-2.97V9.4a6.3 6.3 0 1 0 5.4 6.24V8.7a7.9 7.9 0 0 0 4.9 1.7V7.2a4.5 4.5 0 0 1-4.9-4.2V2Z" />
    </svg>
  );
}
