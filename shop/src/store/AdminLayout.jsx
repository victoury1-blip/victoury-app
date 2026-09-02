import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutGrid, Package, Layers, FileText, Ticket, Settings, Radio, Palette, ShoppingCart, Activity, Percent, LogOut, DownloadCloud } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Wordmark from '../components/Wordmark';

const LIENS = [
  { to: '/store', label: 'Tableau de bord', icon: LayoutGrid, fin: true },
  { to: '/store/produits', label: 'Produits', icon: Package },
  { to: '/store/collections', label: 'Collections', icon: Layers },
  { to: '/store/import-woo', label: 'Importer WooCommerce', icon: DownloadCloud },
  { to: '/store/commandes', label: 'Commandes', icon: ShoppingCart },
  { to: '/store/pages', label: 'Pages', icon: FileText },
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
  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-60 shrink-0 bg-[#0f1424] hidden sm:flex flex-col">
        <div className="px-5 py-5 flex items-center gap-2 border-b border-white/10">
          <Wordmark className="text-white text-base" />
          <span className="text-[9px] font-semibold tracking-wider uppercase bg-white/10 text-white/70 px-1.5 py-0.5 rounded">
            Admin
          </span>
        </div>
        <nav className="flex-1 py-3">
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
          className="flex items-center gap-3 px-5 py-4 text-xs text-gray-400 hover:text-white border-t border-white/10">
          <LogOut size={14} /> Déconnexion
        </button>
      </aside>
      <main className="flex-1 min-w-0 p-5 sm:p-8"><Outlet /></main>
    </div>
  );
}
