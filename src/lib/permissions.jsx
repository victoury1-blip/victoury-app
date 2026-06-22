import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';
import { cloudSet, cloudGet } from './cloudSettings';

const ALL_PERMISSIONS = [
  { key: 'ajout_commandes',  label: 'Ajout commandes' },
  { key: 'modif_commandes',  label: 'Modif. commandes' },
  { key: 'suppr_commandes',  label: 'Suppr. commandes' },
  { key: 'liste_colis',      label: 'Liste des Colis' },
  { key: 'livraison',        label: 'Livraison' },
  { key: 'factures',         label: 'Factures' },
  { key: 'reglages',         label: 'Réglages' },
  { key: 'stock',            label: 'Stock' },
  { key: 'ramassage',        label: 'Ramassage' },
  { key: 'retour',           label: 'Retour' },
  { key: 'profit',           label: 'Profit' },
  { key: 'etats',            label: 'États' },
];

export { ALL_PERMISSIONS };

const PermissionsContext = createContext({ isAdmin: true, permissions: [], hasPermission: () => true, moderators: [], setModerators: () => {}, currentModerator: null, loading: true });

export function PermissionsProvider({ children, session }) {
  const [moderators, setModeratorsState] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    // Try localStorage first for instant display
    try {
      const local = JSON.parse(localStorage.getItem('moderators') || '[]');
      if (Array.isArray(local) && local.length) setModeratorsState(local);
    } catch {}
    // Then sync from cloud
    cloudGet('moderators').then(val => {
      if (Array.isArray(val)) setModeratorsState(val);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [session]);

  const email = session?.user?.email;
  const currentModerator = moderators.find(m => m.email === email);
  const isAdmin = !currentModerator || currentModerator.role === 'admin';

  function hasPermission(perm) {
    if (isAdmin) return true;
    if (!currentModerator) return true;
    return currentModerator.permissions?.includes(perm) || false;
  }

  function setModerators(list) {
    setModeratorsState(list);
    localStorage.setItem('moderators', JSON.stringify(list));
    cloudSet('moderators', list);
  }

  return (
    <PermissionsContext.Provider value={{ isAdmin, permissions: currentModerator?.permissions || [], hasPermission, moderators, setModerators, currentModerator, loading }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionsContext);
}
