/* Journal d'alertes local (rapide, pour le centre d'alertes de l'UI).
   Indépendant de la table Supabase error_logs — sert à afficher à
   l'utilisateur les échecs (synchro Chic/Woo, session expirée, sauvegarde…). */
const KEY = 'app_alert_log';
const SEEN_KEY = 'app_alert_seen';
const MAX = 50;

export function getAlerts() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function logAlert(source, message) {
  try {
    const list = getAlerts();
    const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, source: String(source || 'App'), message: String(message || '').slice(0, 300), ts: new Date().toISOString() };
    // éviter les doublons consécutifs identiques (spam de polling)
    if (list[0] && list[0].source === entry.source && list[0].message === entry.message) return;
    const next = [entry, ...list].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event('app-alert'));
  } catch {}
}

export function clearAlerts() {
  try { localStorage.removeItem(KEY); window.dispatchEvent(new Event('app-alert')); } catch {}
}

export function markAlertsSeen() {
  try { localStorage.setItem(SEEN_KEY, String(Date.now())); window.dispatchEvent(new Event('app-alert')); } catch {}
}

export function getUnseenCount() {
  const seen = Number(localStorage.getItem(SEEN_KEY) || 0);
  return getAlerts().filter(a => new Date(a.ts).getTime() > seen).length;
}
