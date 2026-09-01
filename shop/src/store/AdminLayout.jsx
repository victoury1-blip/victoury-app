import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutGrid, Package, Layers, FileText, Ticket, Settings, Radio, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Wordmark from '../components/Wordmark';

const LIENS = [
  { to: '/store', label: 'Tableau de bord', icon: LayoutGrid, fin: true },
  { to: '/store/produits', label: 'Produits', icon: Package },
  { to: '/store/collections', label: 'Collections', icon: Layers },
  { to: '/store/pages', label: 'Pages', icon: FileText },
  { to: '/store/codes-promo', label: 'Codes promo', icon: Ticket },
  { to: '/store/meta-pixel', label: 'Meta Pixel', icon: Radio },
  { to: '/store/reglages', label: 'Réglages', icon: Settings },
];

export default function AdminLayout() {
  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-56 shrink-0 bg-white border-r border-gray-100 hidden sm:flex flex-col">
        <div className="px-5 py-5 border-b border-gray-100"><Wordmark className="text-base" /></div>
        <nav className="flex-1 py-3">
          {LIENS.map(({ to, label, icon: Icon, fin }) => (
            <NavLink key={to} to={to} end={fin}
              className={({ isActive }) => `flex items-center gap-3 px-5 py-2.5 text-sm ${
                isActive ? 'text-ink font-medium bg-sand' : 'text-gray-500 hover:bg-gray-50'}`}>
              <Icon size={16} /> {label}
            </NavLink>
          ))}
        </nav>
        <button onClick={() => supabase.auth.signOut()}
          className="flex items-center gap-3 px-5 py-4 text-xs text-gray-400 hover:text-ink border-t border-gray-100">
          <LogOut size={14} /> Déconnexion
        </button>
      </aside>
      <main className="flex-1 min-w-0 p-5 sm:p-8"><Outlet /></main>
    </div>
  );
}
