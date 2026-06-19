import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  LayoutDashboard, ShoppingCart, Package, Archive,
  Truck, RotateCcw, BarChart2, MapPin, ChevronDown,
  ChevronRight, Menu, Settings, FileText, TrendingUp,
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '/dashboard',   label: 'Tableau de bord', icon: LayoutDashboard },
  {
    path: '/commandes',
    label: 'Commandes',
    icon: ShoppingCart,
    children: [
      { path: '/commandes/a-confirmer', label: 'À confirmer', statusKey: 'nouveau' },
      { path: '/commandes/en-suivi',    label: 'En suivi',    statusKey: 'en_suivi' },
      { path: '/commandes/reporter',    label: 'Reporter',    statusKey: 'reporter' },
      { path: '/commandes/confirme',    label: 'Confirmé',    statusKey: 'confirme' },
    ],
  },
  { path: '/liste-colis', label: 'Liste des colis', icon: Package },
  { path: '/stock',       label: 'Stock',           icon: Archive },
  {
    path: '/ramassage',
    label: 'Ramassage',
    icon: Truck,
    children: [
      { path: '/ramassage/scanner', label: 'Scanner' },
      { path: '/ramassage/bons',    label: 'Bon' },
    ],
  },
  {
    path: '/retour',
    label: 'Retour',
    icon: RotateCcw,
    children: [
      { path: '/retour/scanner', label: 'Scanner' },
      { path: '/retour/bons',    label: 'Liste des Bons' },
    ],
  },
  { path: '/factures',    label: 'Factures',        icon: FileText },
  { path: '/profit',      label: 'Profit',          icon: TrendingUp },
  { path: '/etats',       label: 'États',           icon: BarChart2 },
  { path: '/livraison',   label: 'Livraison',       icon: MapPin },
  { path: '/reglage',     label: 'Paramètres',      icon: Settings },
];

export default function Sidebar({ orders = [] }) {
  const [collapsed, setCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState({ '/commandes': true, '/ramassage': true, '/retour': true });
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-56'} bg-white border-r border-gray-200 flex flex-col transition-all duration-200 shrink-0 h-screen`}>
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
        {!collapsed && (() => {
          try {
            const cfg = JSON.parse(localStorage.getItem('victoury_app_config') || '{}');
            if (cfg.appLogo) return <img src={cfg.appLogo} alt="" className="h-12 object-contain" />;
            return <span className="text-xl font-black tracking-widest text-gray-900 uppercase">{cfg.appName || 'VICTOURY'}</span>;
          } catch { return <span className="text-xl font-black tracking-widest text-gray-900 uppercase">VICTOURY</span>; }
        })()}
        <button onClick={() => setCollapsed(!collapsed)} className="p-1 rounded hover:bg-gray-100 text-gray-500">
          <Menu size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;

          if (item.children) {
            return (
              <div key={item.path}>
                <button
                  onClick={() => { navigate(item.children[0]?.path || item.path); setOpenMenus(prev => ({ ...prev, [item.path]: !prev[item.path] })); }}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${isActive(item.path) ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  <Icon size={16} className="shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      {openMenus[item.path] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </>
                  )}
                </button>
                {openMenus[item.path] && !collapsed && (
                  <div className="pl-8">
                    {item.children.map((child) => {
                      const COLIS_PIPE = new Set(['att_ramassage','expedier','recu_livreur','livre','change','refuse','pas_rep_lv','pret_retour','dem_suivi','injoignable','manque_stock','en_suivi']);
                      const count = orders.filter(o => {
                        if (COLIS_PIPE.has(o.status) || (o.trackingNumber && o.validated)) return false;
                        return o.status === child.statusKey;
                      }).length;
                      const active = location.pathname === child.path;
                      return (
                        <button
                          key={child.path}
                          onClick={() => navigate(child.path)}
                          className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors mb-0.5 ${active ? 'bg-blue-600 text-white font-semibold' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                          <span>{child.label}</span>
                          {count > 0 && (
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${active ? 'bg-white text-blue-600' : 'bg-red-500 text-white'}`}>
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${active ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              <Icon size={16} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={`px-3 py-3 border-t border-gray-100 flex items-center ${collapsed ? 'justify-center' : 'gap-2'}`}>
        <div className="w-8 h-8 rounded-full bg-gray-800 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">V</div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <span className="text-sm text-gray-700 font-medium block truncate">Admin</span>
            <button onClick={() => supabase.auth.signOut()} className="text-xs text-red-400 hover:text-red-600 transition">
              Déconnexion
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
