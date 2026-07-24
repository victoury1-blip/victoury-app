import { supabase } from './supabase';
import { now } from './dateUtils';

/** Nom lisible d'un utilisateur à partir de son email (profils locaux). */
export function getUserDisplayName(email) {
  try {
    const profiles = JSON.parse(localStorage.getItem('user_profiles') || '[]');
    const p = profiles.find(u => u.email === email);
    return p ? `${p.name} (${p.role})` : (email || 'inconnu');
  } catch { return email || 'inconnu'; }
}

/**
 * Journalise un changement de statut/livreur dans localStorage (cache par appareil)
 * et dans la table Supabase `order_history`.
 */
export function recordHistory(orderId, status, user, fromStatus = null, note = null) {
  const key = `order_history_${orderId}`;
  let hist = [];
  try { hist = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
  const ts = now();
  const entry = { timestamp: ts, status, fromStatus, note, user: getUserDisplayName(user) };
  hist.push(entry);
  localStorage.setItem(key, JSON.stringify(hist));
  supabase.from('order_history')
    .insert({ order_id: orderId, status, user_name: entry.user, timestamp: ts })
    .then(() => {}).catch?.(() => {});
}
