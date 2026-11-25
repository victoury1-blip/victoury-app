import React from 'react';

/* « Commande du site — relance panier abandonné » : affiché en badge. */
export const RE_RELANCE = /relance\s+panier\s+abandonn/i;

export function BadgeRelance() {
  return (
    <span className="inline-flex w-fit items-center gap-1 text-[11px] font-bold text-white bg-gradient-to-r from-pink-500 to-rose-500 rounded-full px-2.5 py-1 shadow-sm">
      🔁 Relance
    </span>
  );
}
