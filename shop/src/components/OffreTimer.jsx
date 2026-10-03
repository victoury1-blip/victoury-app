import React, { useEffect, useState } from 'react';
import { useLang } from '../lib/i18n';

function tempsRestant() {
  const minuit = new Date();
  minuit.setHours(24, 0, 0, 0);
  return Math.max(0, minuit.getTime() - Date.now());
}

function formater(ms) {
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

// Urgence honnête : l'offre expire réellement à minuit (heure locale du
// client), le compte à rebours recommence le lendemain avec la nouvelle
// journée — jamais un faux délai qui ne finit jamais.
export default function OffreTimer({ className = '' }) {
  const { lang } = useLang();
  const [reste, setReste] = useState(tempsRestant());

  useEffect(() => {
    const id = setInterval(() => setReste(tempsRestant()), 1000);
    return () => clearInterval(id);
  }, []);

  const ar = lang === 'ar';
  return (
    <div className={`flex items-center gap-2 text-[11px] sm:text-xs ${className}`} dir="ltr">
      <span className="animate-pulse text-red-600">⏰</span>
      <span className="text-gray-700">{ar ? 'العرض ينتهي الليلة في' : "L'offre se termine ce soir à"}</span>
      <span className="font-bold tabular-nums text-red-600">{formater(reste)}</span>
    </div>
  );
}
