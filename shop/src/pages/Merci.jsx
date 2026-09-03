import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useLang } from '../lib/i18n';

export default function Merci() {
  const { id } = useParams();
  const { t, lang } = useLang();
  return (
    <div className="max-w-2xl mx-auto px-6 py-24 text-center">
      <div className="w-14 h-14 rounded-full bg-green-600 text-white grid place-items-center mx-auto"><Check size={26} /></div>
      <h1 className="mt-6 text-lg tracking-[0.2em] uppercase">{lang === 'ar' ? 'تم تسجيل الطلب' : 'Commande enregistrée'}</h1>
      <p className="mt-3 text-sm text-gray-600">
        {lang === 'ar' ? 'شكرًا لكم! سنتصل بكم قريبًا لتأكيد طلبكم.' : 'Merci ! Nous vous appelons très vite pour confirmer votre commande.'}
      </p>
      {/* Le numéro sert au client au téléphone : sans lui, il faut chercher par nom. */}
      {id && <p className="mt-4 text-xs text-gray-400">{t('numeroCommande')} : <span className="font-mono">{id}</span></p>}
      <Link to="/" className="inline-block mt-8 border border-ink px-8 py-3 text-[11px] tracking-widest uppercase">
        {t('retourBoutique')}
      </Link>
    </div>
  );
}
