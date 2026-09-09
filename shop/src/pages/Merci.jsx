import React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { fmtPrix } from '../lib/pricing';
import { useLang } from '../lib/i18n';

/* Reçu de commande complet (coordonnées + articles + total), transmis
   depuis Commander.jsx au moment de la validation — la commande n'existe
   nulle part ailleurs côté client une fois le panier vidé, et re-demander
   la commande à Supabase par son id public exposerait celle de n'importe
   quel client à qui devine/partage son numéro. Un accès direct à cette
   page (lien rouvert, page rafraîchie) retombe donc sur le message générique
   d'origine, sans détail. */
export default function Merci() {
  const { id } = useParams();
  const { state } = useLocation();
  const { t, lang } = useLang();
  const ar = lang === 'ar';

  if (!state) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <div className="w-14 h-14 rounded-full bg-green-600 text-white grid place-items-center mx-auto"><Check size={26} /></div>
        <h1 className="mt-6 text-lg tracking-[0.2em] uppercase">{ar ? 'تم تسجيل الطلب' : 'Commande enregistrée'}</h1>
        <p className="mt-3 text-sm text-gray-600">
          {ar ? 'شكرًا لكم! سنتصل بكم قريبًا لتأكيد طلبكم.' : 'Merci ! Nous vous appelons très vite pour confirmer votre commande.'}
        </p>
        {id && <p className="mt-4 text-xs text-gray-400">{t('numeroCommande')} : <span className="font-mono">{id}</span></p>}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/" className="inline-block border border-ink px-8 py-3 text-[11px] tracking-widest uppercase">
            {t('retourBoutique')}
          </Link>
          <Link to="/suivi" className="inline-block bg-ink text-white px-8 py-3 text-[11px] tracking-widest uppercase">
            {t('suivreCommande')}
          </Link>
        </div>
      </div>
    );
  }

  const { form, lignes, total } = state;

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <div className="text-center">
        <div className="w-14 h-14 rounded-full bg-green-600 text-white grid place-items-center mx-auto"><Check size={26} /></div>
        <h1 className="mt-6 text-lg tracking-[0.2em] uppercase">{ar ? 'تم تأكيد الطلب' : 'Commande confirmée'}</h1>
        {id && <p className="mt-1 text-xs text-gray-400 font-mono">{ar ? 'رقم' : 'Numéro'} #{id}</p>}
      </div>

      <div className="mt-8 border-t border-gray-100 pt-5">
        <h2 className="text-[11px] tracking-widest uppercase text-gray-400">
          {ar ? 'معلومات التوصيل' : 'Coordonnées de livraison'}
        </h2>
        {/* dir="rtl" en arabe : sans lui, le libellé arabe (première case du
            flex) restait affiché à gauche par défaut du navigateur, alors
            que la lecture arabe attend le libellé à droite et la valeur
            (souvent un nom saisi en alphabet latin) à gauche. */}
        <dl className="mt-3 space-y-2 text-sm" dir={ar ? 'rtl' : 'ltr'}>
          {[
            [ar ? 'الاسم' : 'Nom', form.nom],
            [ar ? 'الهاتف' : 'Téléphone', form.telephone],
            [ar ? 'المدينة' : 'Ville', form.ville],
            [ar ? 'العنوان' : 'Adresse', form.adresse],
          ].filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-gray-400 shrink-0">{k}</dt>
              <dd className="text-gray-800 text-left" dir="auto">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-8 border-t border-gray-100 pt-5">
        <h2 className="text-[11px] tracking-widest uppercase text-gray-400">
          {ar ? 'تفاصيل الطلب' : 'Détails de la commande'}
        </h2>
        <div className="mt-3 divide-y divide-gray-50">
          {lignes.map(l => (
            <div key={`${l.slug}::${l.size || ''}`} className="flex items-center gap-3 py-3">
              <div className="w-14 h-16 bg-sand shrink-0 overflow-hidden rounded">
                {l.image && <img src={l.image} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 truncate">{l.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {[l.size, l.color].filter(Boolean).join(' · ')} {ar ? '· الكمية' : '· Qté'} : {l.qty}
                </p>
              </div>
              <span className="text-sm font-medium text-gray-800 shrink-0">{fmtPrix(l.price * l.qty)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100 text-sm font-semibold">
          <span>{ar ? 'المجموع' : 'Total'}</span>
          <span>{fmtPrix(total)}</span>
        </div>
      </div>

      <Link to="/suivi" className="mt-10 block w-full text-center border border-ink py-4 text-xs tracking-widest uppercase">
        {t('suivreCommande')}
      </Link>
      <Link to="/" className="mt-3 block w-full text-center bg-ink text-white py-4 text-xs tracking-widest uppercase">
        {ar ? 'متابعة التسوق' : 'Continuer mes achats'}
      </Link>
    </div>
  );
}
