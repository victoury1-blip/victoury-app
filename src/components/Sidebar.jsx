import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { cloudGet, cloudSet } from '../lib/cloudSettings';
import { usePermissions } from '../lib/permissions';
import { useToast } from './Toast';
import {
  LayoutDashboard, ShoppingCart, Package, Archive, Store,
  Truck, RotateCcw, BarChart2, MapPin, ChevronDown, Activity,
  ChevronRight, Menu, Settings, FileText, TrendingUp, Shield, X,
  Camera, Mail, Lock, Eye, EyeOff, Save, CheckCircle2, User, FileSpreadsheet,
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '/dashboard',   label: 'Tableau de bord', icon: LayoutDashboard },
  { path: '/analytics',   label: 'Statistiques',    icon: Activity },
  {
    path: '/commandes',
    label: 'Commandes',
    icon: ShoppingCart,
    children: [
      { path: '/commandes/a-confirmer', label: 'À Confirmer', statusKey: 'nouveau' },
      { path: '/commandes/en-suivi',    label: 'En Suivi',    statusKey: 'en_suivi' },
      { path: '/commandes/reporter',    label: 'Reporté',     statusKey: 'reporter' },
      { path: '/commandes/confirme',    label: 'Confirmé',    statusKey: 'confirme' },
    ],
  },
  { path: '/liste-colis', label: 'Liste des Colis', icon: Package, perm: 'liste_colis' },
  { path: '/import-sheets', label: 'Google Sheets', icon: FileSpreadsheet, perm: 'liste_colis' },
  { path: '/stock',       label: 'Stock',           icon: Archive, perm: 'stock' },
  { path: '/chic-affiliate', label: 'Chic Affiliate', icon: Store },
  {
    path: '/ramassage',
    label: 'Ramassage',
    icon: Truck,
    perm: 'ramassage',
    children: [
      { path: '/ramassage/scanner', label: 'Scanner' },
      { path: '/ramassage/bons',    label: 'Bon' },
    ],
  },
  {
    path: '/retour',
    label: 'Retour',
    icon: RotateCcw,
    perm: 'retour',
    children: [
      { path: '/retour/scanner', label: 'Scanner' },
      { path: '/retour/bons',    label: 'Liste des Bons' },
    ],
  },
  { path: '/factures',    label: 'Factures',        icon: FileText, perm: 'factures' },
  { path: '/profit',      label: 'Profit',          icon: TrendingUp, perm: 'profit' },
  { path: '/etats',       label: 'États',           icon: BarChart2, perm: 'etats' },
  { path: '/livraison',   label: 'Livraison',       icon: MapPin, perm: 'livraison' },
  { path: '/moderateurs', label: 'Modérateurs',     icon: Shield, adminOnly: true },
  { path: '/reglage',     label: 'Paramètres',      icon: Settings, perm: 'reglages' },
];

function ProfileModal({ onClose, session }) {
  const toast = useToast();
  const [profile, setProfile] = useState(() => {
    try { return JSON.parse(localStorage.getItem('victoury_profile') || '{}'); } catch { return {}; }
  });
  const [saved, setSaved] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [showPwField, setShowPwField] = useState({ current: false, next: false, confirm: false });
  const [pwMsg, setPwMsg] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    cloudGet('victoury_profile').then(data => {
      if (data && typeof data === 'object') {
        setProfile(data);
        localStorage.setItem('victoury_profile', JSON.stringify(data));
      }
    });
  }, []);

  function saveProfile(p) {
    setProfile(p);
    localStorage.setItem('victoury_profile', JSON.stringify(p));
    cloudSet('victoury_profile', p);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleAvatar(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500_000) { toast.warning('Image trop grande (max 500 KB)'); return; }
    const reader = new FileReader();
    reader.onload = ev => saveProfile({ ...profile, avatar: ev.target.result });
    reader.readAsDataURL(file);
  }

  async function changePassword() {
    setPwMsg(null);
    if (!pw.next || pw.next.length < 6) { setPwMsg({ type: 'error', text: 'Le mot de passe doit contenir au moins 6 caractères' }); return; }
    if (pw.next !== pw.confirm) { setPwMsg({ type: 'error', text: 'Les mots de passe ne correspondent pas' }); return; }
    const { error } = await supabase.auth.updateUser({ password: pw.next });
    if (error) { setPwMsg({ type: 'error', text: error.message }); return; }
    setPwMsg({ type: 'success', text: 'Mot de passe modifié ! Utilisez le nouveau mot de passe sur vos autres appareils.' });
    setPw({ current: '', next: '', confirm: '' });
  }

  const email = session?.user?.email || '';

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><User size={18} className="text-blue-600" /> Mon Profil</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={16} className="text-gray-400" /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Avatar */}
          <div className="flex flex-col items-center">
            <div className="relative group">
              {profile.avatar ? (
                <img src={profile.avatar} alt="avatar" className="w-24 h-24 rounded-full object-cover border-4 border-blue-100" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 text-white flex items-center justify-center text-3xl font-bold border-4 border-blue-100">
                  {(profile.name || email || 'V')[0].toUpperCase()}
                </div>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 transition"
              >
                <Camera size={14} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
            </div>
            {profile.avatar && (
              <button onClick={() => saveProfile({ ...profile, avatar: null })} className="text-xs text-red-500 mt-2 hover:underline">Supprimer la photo</button>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nom complet</label>
            <input
              type="text"
              value={profile.name || ''}
              onChange={e => saveProfile({ ...profile, name: e.target.value })}
              placeholder="Votre nom"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
            <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
              <Mail size={14} className="text-gray-400" />
              {email}
            </div>
          </div>

          {/* Password change */}
          <div className="border-t border-gray-100 pt-4">
            <button onClick={() => setShowPw(!showPw)} className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-blue-600 transition">
              <Lock size={14} />
              Changer le mot de passe
              <ChevronDown size={14} className={`transition-transform ${showPw ? 'rotate-180' : ''}`} />
            </button>

            {showPw && (
              <div className="mt-3 space-y-3">
                <div className="relative">
                  <input
                    type={showPwField.next ? 'text' : 'password'}
                    value={pw.next}
                    onChange={e => setPw({ ...pw, next: e.target.value })}
                    placeholder="Nouveau mot de passe"
                    className="w-full px-4 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  <button type="button" onClick={() => setShowPwField(p => ({ ...p, next: !p.next }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPwField.next ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPwField.confirm ? 'text' : 'password'}
                    value={pw.confirm}
                    onChange={e => setPw({ ...pw, confirm: e.target.value })}
                    placeholder="Confirmer le nouveau mot de passe"
                    className="w-full px-4 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  <button type="button" onClick={() => setShowPwField(p => ({ ...p, confirm: !p.confirm }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPwField.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {pwMsg && (
                  <p className={`text-xs font-medium ${pwMsg.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>{pwMsg.text}</p>
                )}
                <button onClick={changePassword} className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition">
                  Enregistrer le mot de passe
                </button>
              </div>
            )}
          </div>

          {saved && (
            <div className="flex items-center gap-2 text-green-600 text-xs font-medium bg-green-50 px-3 py-2 rounded-lg">
              <CheckCircle2 size={14} /> Profil enregistré et synchronisé
            </div>
          )}

          {/* Déconnexion */}
          <div className="border-t border-gray-100 pt-4">
            <button
              onClick={() => supabase.auth.signOut()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-100 transition border border-red-200"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ orders = [], session }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState({ '/commandes': true });
  const [showProfile, setShowProfile] = useState(false);
  const [profile, setProfile] = useState(() => {
    try { return JSON.parse(localStorage.getItem('victoury_profile') || '{}'); } catch { return {}; }
  });

  useEffect(() => {
    const handler = () => {
      try { setProfile(JSON.parse(localStorage.getItem('victoury_profile') || '{}')); } catch {}
    };
    window.addEventListener('storage', handler);
    const interval = setInterval(handler, 5000);
    return () => { window.removeEventListener('storage', handler); clearInterval(interval); };
  }, []);
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission, isAdmin, currentModerator } = usePermissions();

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const visibleItems = NAV_ITEMS.filter(item => {
    if (item.adminOnly) return isAdmin;
    if (item.perm) return hasPermission(item.perm);
    return true;
  });

  function handleNav(path) {
    navigate(path);
    setMobileOpen(false);
  }

  const sidebarContent = (isMobile) => (
    <>
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
        {(!collapsed || isMobile) && (() => {
          let inner;
          try {
            const cfg = JSON.parse(localStorage.getItem('victoury_app_config') || '{}');
            inner = cfg.appLogo
              ? <img src={cfg.appLogo} alt="" className="h-12 object-contain" />
              : <span className="text-xl font-black tracking-widest text-gray-900 uppercase">{cfg.appName || 'VICTOURY'}</span>;
          } catch {
            inner = <span className="text-xl font-black tracking-widest text-gray-900 uppercase">VICTOURY</span>;
          }
          return (
            <a href="https://victoury-maroc.com" target="_blank" rel="noopener noreferrer" title="Aller sur victoury-maroc.com" className="hover:opacity-80 transition-opacity">
              {inner}
            </a>
          );
        })()}
        {isMobile ? (
          <button onClick={() => setMobileOpen(false)} className="p-1 rounded hover:bg-gray-100 text-gray-500">
            <X size={20} />
          </button>
        ) : (
          <button onClick={() => setCollapsed(!collapsed)} className="p-1 rounded hover:bg-gray-100 text-gray-500">
            <Menu size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const showLabel = isMobile || !collapsed;

          if (item.children) {
            return (
              <div key={item.path}>
                <button
                  onClick={() => { if (!isMobile) handleNav(item.children[0]?.path || item.path); setOpenMenus(prev => ({ ...prev, [item.path]: !prev[item.path] })); }}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${isActive(item.path) ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  <Icon size={16} className="shrink-0" />
                  {showLabel && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      {openMenus[item.path] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </>
                  )}
                </button>
                {openMenus[item.path] && showLabel && (
                  <div className="pl-8">
                    {item.children.map((child) => {
                      const COLIS_PIPE = new Set(['att_ramassage','expedier','recu_livreur','livre','change','refuse','pas_rep_lv','pret_retour','dem_suivi','injoignable','manque_stock','en_suivi','retour_recu','echange_recu']);
                      const count = orders.filter(o => {
                        if (COLIS_PIPE.has(o.status) || (o.trackingNumber && o.validated)) return false;
                        return o.status === child.statusKey;
                      }).length;
                      const active = location.pathname === child.path;
                      return (
                        <button
                          key={child.path}
                          onClick={() => handleNav(child.path)}
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
          const itemBadge = item.path === '/chic-affiliate'
            ? orders.filter(o => o.status === 'chic_nouveau').length
            : 0;
          return (
            <button
              key={item.path}
              onClick={() => handleNav(item.path)}
              className={`relative w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${active ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              <Icon size={16} className="shrink-0" />
              {showLabel && <span className="flex-1 text-left">{item.label}</span>}
              {itemBadge > 0 && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${active ? 'bg-blue-600 text-white' : 'bg-red-500 text-white'} ${!showLabel ? 'absolute right-1 top-1' : ''}`}>
                  {itemBadge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

    </>
  );

  return (
    <>
      {/* Mobile: hamburger button fixed top-left */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-40 p-2 bg-white border border-gray-200 rounded-lg shadow-sm text-gray-700 sm:hidden"
      >
        <Menu size={20} />
      </button>

      {/* Profil : chip fixe en haut à droite (menu utilisateur) */}
      <button
        onClick={() => setShowProfile(true)}
        className="fixed top-2.5 right-3 z-40 flex items-center gap-2 bg-white border border-gray-200 rounded-full shadow-sm pl-1 pr-3 py-1 hover:shadow transition"
        title="Profil"
      >
        {profile.avatar ? (
          <img src={profile.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-gray-800 text-white flex items-center justify-center text-xs font-bold">
            {(profile.name || currentModerator?.name || 'V')[0]?.toUpperCase()}
          </div>
        )}
        <span className="text-sm font-medium text-gray-700 max-w-[140px] truncate hidden sm:block">{profile.name || currentModerator?.name || 'Admin'}</span>
      </button>

      {/* Mobile: overlay sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 sm:hidden" onClick={() => setMobileOpen(false)}>
          <div className="fixed inset-0 bg-black/40" />
          <aside className="relative w-64 h-full bg-white flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            {sidebarContent(true)}
          </aside>
        </div>
      )}

      {/* Desktop: normal sidebar */}
      <aside className={`${collapsed ? 'w-16' : 'w-56'} bg-white border-r border-gray-200 flex-col transition-all duration-200 shrink-0 h-screen hidden sm:flex`}>
        {sidebarContent(false)}
      </aside>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} session={session} />}
    </>
  );
}
