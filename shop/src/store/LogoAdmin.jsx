import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Wordmark from '../components/Wordmark';

/* Le vrai logo Victoury — celui réglé dans l'application (Paramètres →
   Logo, clé `victoury_app_config` de la table `settings`) — pour que
   l'administration de la boutique porte la même identité que l'appli.
   Gardé en cache sur l'appareil ; à défaut, le nom en texte. */
const CLE_CACHE = 'victoury_shop_admin_logo';

export default function LogoAdmin({ taille = 'base' }) {
  const [logo, setLogo] = useState(() => {
    try { return localStorage.getItem(CLE_CACHE) || ''; } catch { return ''; }
  });

  useEffect(() => {
    let actif = true;
    supabase.from('settings').select('value').eq('key', 'victoury_app_config').maybeSingle()
      .then(({ data }) => {
        let v = data?.value;
        if (typeof v === 'string') { try { v = JSON.parse(v); } catch { v = null; } }
        const url = v?.appLogo || '';
        if (!actif || !url) return;
        setLogo(url);
        try { localStorage.setItem(CLE_CACHE, url); } catch { /* quota : simple cache */ }
      })
      .catch(() => {});
    return () => { actif = false; };
  }, []);

  if (!logo) return <Wordmark className={`text-white ${taille === 'sm' ? 'text-sm' : 'text-base'}`} />;
  return (
    <span className={`inline-flex items-center bg-white rounded-md ${taille === 'sm' ? 'h-7 px-1.5' : 'h-8 px-2'}`}>
      <img src={logo} alt="Victoury" className={`${taille === 'sm' ? 'h-5' : 'h-6'} w-auto object-contain`} />
    </span>
  );
}
