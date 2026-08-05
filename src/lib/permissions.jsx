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

  const email = (session?.user?.email || '').toLowerCase();
  const currentModerator = moderators.find(m => (m.email || '').toLowerCase() === email);
  // Compte désactivé -> aucun droit, même s'il figure encore dans la liste.
  const disabled = currentModerator ? currentModerator.active === false : false;

  // Liste d'admins optionnelle (VITE_ADMIN_EMAILS="a@x.com,b@x.com").
  // Si elle est définie, seuls ces emails obtiennent le repli « non listé = admin »
  // (le propriétaire n'apparaît jamais dans la table des modérateurs).
  const allowlist = String(import.meta.env.VITE_ADMIN_EMAILS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

  const isAdmin = disabled
    ? false
    : currentModerator
      ? currentModerator.role === 'admin'
      // Tant que la liste n'est pas chargée on n'accorde pas les droits admin
      // (sinon un modérateur voit l'interface complète pendant le chargement).
      : !loading && (allowlist.length ? allowlist.includes(email) : true);

  function hasPermission(perm) {
    if (disabled) return false;
    if (isAdmin) return true;
    return currentModerator?.permissions?.includes(perm) || false;
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
