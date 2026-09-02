import React from 'react';
import { Package, Headphones, Wallet } from 'lucide-react';

const ICONES = [Package, Headphones, Wallet];

/* Les trois arguments qui rassurent le plus un premier achat en ligne au
   Maroc : livraison, joignabilité, paiement à la livraison — dans cet ordre
   fixe, juste sous le Hero. Éditable (titre/texte) depuis /store/theme. */
export default function Reassurance({ items, active }) {
  if (active === false || !items?.length) return null;
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-14 grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
      {items.map((it, i) => {
        const Icone = ICONES[i % ICONES.length];
        return (
          <div key={i} className="flex gap-4 py-5 sm:py-0 sm:px-6 first:sm:pl-0 last:sm:pr-0">
            <div className="shrink-0 w-11 h-11 rounded-full border border-gray-200 grid place-items-center">
              <Icone size={18} className="text-ink" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">{it.titre}</p>
              <p className="mt-1 text-xs text-gray-500 leading-relaxed">{it.texte}</p>
            </div>
          </div>
        );
      })}
    </section>
  );
}
