import React from 'react';
import { Truck, Banknote, ShieldCheck, RotateCcw } from 'lucide-react';
import { useLang } from '../lib/i18n';

/* Grille 2×2 sous le bouton d'achat — les quatre arguments qui rassurent un
   premier achat COD au Maroc, visibles au moment exact où le client hésite
   encore. Statique (pas de réglage /store/theme) : ce sont des faits vrais
   pour tout le catalogue, pas une promo à personnaliser produit par
   produit. */
export default function GarantiesGrid() {
  const { t, lang } = useLang();
  const items = [
    { Icone: Truck, titre: t('garantiesLivraisonTitre'), texte: t('garantiesLivraisonTexte') },
    { Icone: Banknote, titre: t('garantiesPaiementTitre'), texte: t('garantiesPaiementTexte') },
    { Icone: ShieldCheck, titre: t('garantiesGarantieTitre'), texte: t('garantiesGarantieTexte') },
    { Icone: RotateCcw, titre: t('garantiesRetourTitre'), texte: t('garantiesRetourTexte') },
  ];

  return (
    <div className="mt-4 grid grid-cols-2 gap-2.5">
      {items.map(({ Icone, titre, texte }, i) => (
        <div key={i} dir={lang === 'ar' ? 'rtl' : 'ltr'}
          className={`border border-gray-200 rounded-xl p-3 flex flex-col gap-1.5 ${lang === 'ar' ? 'items-end text-right' : 'items-start text-left'}`}>
          <div className="w-8 h-8 rounded-full bg-orange-50 grid place-items-center">
            <Icone size={16} className="text-orange-500" />
          </div>
          <p className="text-xs font-semibold text-ink leading-tight">{titre}</p>
          <p className="text-[11px] text-gray-400 leading-tight">{texte}</p>
        </div>
      ))}
    </div>
  );
}
