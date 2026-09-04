import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutGrid, Package, Layers, FileText, Ticket, Settings, Radio, Palette, ShoppingCart, Activity, Percent, LogOut, DownloadCloud, MessageSquareQuote, Image, Menu, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { jouerSonCommande } from '../lib/sonCommande';
import { demanderPermissionNotif, notifierNouvelleCommande } from '../lib/notifCommande';
import { activerPushCommande, pushDisponible } from '../lib/pushNotif';
import { chargerReglages } from '../lib/catalog';
import Wordmark from '../components/Wordmark';

const LIENS = [
  { to: '/store', label: 'Tableau de bord', icon: LayoutGrid, fin: true },
  { to: '/store/produits', label: 'Produits', icon: Package },
  { to: '/store/collections', label: 'Collections', icon: Layers },
  { to: '/store/import-woo', label: 'Importer WooCommerce', icon: DownloadCloud },
  { to: '/store/media', label: 'Médiathèque', icon: Image },
  { to: '/store/commandes', label: 'Commandes', icon: ShoppingCart },
  { to: '/store/pages', label: 'Pages', icon: FileText },
  { to: '/store/avis', label: 'Avis clients', icon: MessageSquareQuote },
  { to: '/store/theme', label: 'Edit Theme', icon: Palette },
  { to: '/store/remises', label: 'Remises', icon: Percent },
  { to: '/store/codes-promo', label: 'Codes promo', icon: Ticket },
  { to: '/store/meta-pixel', label: 'Meta Pixel', icon: Radio },
  { to: '/store/microsoft-clarity', label: 'Microsoft Clarity', icon: Activity },
  { to: '/store/reglages', label: 'Réglages', icon: Settings },
];

/* Le fond de travail (contenu, formulaires) reste clair : c'est là que se lisent
 * des tableaux de chiffres et des champs de saisie, où le blanc reste le plus
 * confortable. Le panneau de navigation, lui, prend une teinte sombre — comme
 * Volcano — pour qu'on distingue d'un regard qu'on est dans l'ADMINISTRATION
 * et non dans la boutique publique : deux univers qu'il ne faut jamais confondre.
 * Le blanc du texte sur ce fond est le contraste le plus net qui existe — plus
 * lisible qu'un gris, aussi discret soit-il. */
export default function AdminLayout() {
  // Un carillon à chaque commande du site (id VS-...), sur n'importe quelle
  // page de l'administration — pas seulement le Tableau de bord — comme le
  // fait WooCommerce, pour qu'une commande ne passe pas inaperçue pendant
  // qu'on travaille ailleurs dans l'admin.
  const sonRef = useRef('');
  useEffect(() => { chargerReglages().then(r => { sonRef.current = r.sonCommandeUrl || ''; }).catch(() => {}); }, []);

  // Le panneau de navigation était entièrement masqué sous sm (hidden sm:flex)
  // sans aucun moyen de l'ouvrir — sur téléphone, l'administration n'avait
  // tout simplement pas de menu. Un tiroir coulissant, comme sur la boutique.
  const [menuOuvert, setMenuOuvert] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setMenuOuvert(false); }, [pathname]);

  useEffect(() => {
    const canal = supabase
      .channel('shop-nouvelle-commande')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        if (!String(payload.new?.id || '').startsWith('VS-')) return;
        jouerSonCommande(sonRef.current);
        notifierNouvelleCommande(payload.new);
      })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, []);

  // Les navigateurs (surtout sur téléphone) bloquent tout son déclenché sans
  // geste préalable de la personne, ET Chrome refuse carrément d'afficher la
  // demande d'autorisation "Notifications" si elle part d'un chargement de
  // page plutôt que d'un clic — la permission restait bloquée à "default"
  // sans même montrer de pop-up. Le premier contact avec la page débloque
  // donc les deux à la fois : un son inaudible pour l'audio, et la vraie
  // demande de permission pour les notifications système.
  useEffect(() => {
    let debloque = false;
    const debloquer = () => {
      if (debloque) return;
      debloque = true;
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0;
        osc.connect(gain).connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.01);
      } catch { /* tant pis, le premier son restera silencieux */ }
      demanderPermissionNotif();
      // Best-effort : ne bloque rien si le push n'est pas configuré sur ce
      // site (clé VAPID absente) — la notification "en direct" (onglet
      // ouvert) reste garantie par demanderPermissionNotif() ci-dessus.
      if (pushDisponible()) activerPushCommande().catch(() => {});
      window.removeEventListener('pointerdown', debloquer);
      window.removeEventListener('keydown', debloquer);
    };
    window.addEventListener('pointerdown', debloquer);
    window.addEventListener('keydown', debloquer);
    return () => {
      window.removeEventListener('pointerdown', debloquer);
      window.removeEventListener('keydown', debloquer);
    };
  }, []);

  const Nav = (
    <>
      <nav className="flex-1 py-3 overflow-y-auto">
        {LIENS.map(({ to, label, icon: Icon, fin }) => (
          <NavLink key={to} to={to} end={fin}
            className={({ isActive }) => `flex items-center gap-3 px-5 py-2.5 text-sm border-l-2 transition-colors ${
              isActive
                ? 'text-white font-medium bg-white/10 border-l-white'
                : 'text-gray-300 border-l-transparent hover:bg-white/5 hover:text-white'}`}>
            <Icon size={16} /> {label}
          </NavLink>
        ))}
      </nav>
      <button onClick={() => supabase.auth.signOut()}
        className="flex items-center gap-3 px-5 py-4 text-xs text-gray-400 hover:text-white border-t border-white/10 shrink-0">
        <LogOut size={14} /> Déconnexion
      </button>
    </>
  );

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Barre du haut, téléphone seulement : le bouton qui ouvre le tiroir —
          sans elle, aucun moyen d'atteindre le menu sur petit écran. */}
      <div className="sm:hidden fixed top-0 inset-x-0 z-30 h-14 bg-[#0f1424] flex items-center justify-between px-4">
        <Wordmark className="text-white text-sm" />
        <button onClick={() => setMenuOuvert(true)} className="text-white p-1.5" aria-label="Menu">
          <Menu size={20} />
        </button>
      </div>

      {menuOuvert && (
        <div className="sm:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOuvert(false)} />
          <aside className="relative w-64 max-w-[80vw] bg-[#0f1424] flex flex-col">
            <div className="px-5 py-5 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2">
                <Wordmark className="text-white text-base" />
                <span className="text-[9px] font-semibold tracking-wider uppercase bg-white/10 text-white/70 px-1.5 py-0.5 rounded">Admin</span>
              </div>
              <button onClick={() => setMenuOuvert(false)} className="text-white/70 p-1" aria-label="Fermer"><X size={18} /></button>
            </div>
            {Nav}
          </aside>
        </div>
      )}

      <aside className="w-60 shrink-0 bg-[#0f1424] hidden sm:flex flex-col">
        <div className="px-5 py-5 flex items-center gap-2 border-b border-white/10">
          <Wordmark className="text-white text-base" />
          <span className="text-[9px] font-semibold tracking-wider uppercase bg-white/10 text-white/70 px-1.5 py-0.5 rounded">
            Admin
          </span>
        </div>
        {Nav}
      </aside>
      <main className="flex-1 min-w-0 p-5 pt-20 sm:p-8"><Outlet /></main>
    </div>
  );
}
