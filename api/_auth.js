// Autorisation des endpoints serveur.
//
// RÈGLE : seul un jeton Supabase valide autorise l'accès.
// L'ancienne tolérance « same-origin » est SUPPRIMÉE : les en-têtes Origin/Referer
// sont librement falsifiables hors navigateur (curl), ce qui rendait publics des
// endpoints coûteux (assistant IA) ou sensibles (statut Ozon, WooCommerce).
//
// (Fichier préfixé « _ » : importable mais non exposé comme route.)

/** Retourne l'utilisateur Supabase du jeton porté par la requête, ou null. */
export async function getUser(req) {
  try {
    const auth = req.headers['authorization'] || req.headers['Authorization'] || '';
    const m = /^Bearer\s+(.+)$/i.exec(String(auth).trim());
    if (!m) return null;
    const token = m[1].trim();
    if (!token || token.length < 20) return null;

    const SUPA_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    if (!SUPA_URL || !ANON) return null;

    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 8000);
    try {
      const r = await fetch(`${SUPA_URL.replace(/\/$/, '')}/auth/v1/user`, {
        headers: { apikey: ANON, Authorization: `Bearer ${token}` },
        signal: ac.signal,
      });
      clearTimeout(t);
      if (!r.ok) return null;
      const u = await r.json();
      return u && u.id ? u : null;
    } catch { clearTimeout(t); return null; }
  } catch { return null; }
}

async function verifyToken(req) {
  return !!(await getUser(req));
}

/** Jeton Supabase valide obligatoire. */
export async function isAuthenticated(req) {
  return verifyToken(req);
}

/** Identique — conservé pour les endpoints sensibles (nommage explicite). */
export async function isAuthenticatedStrict(req) {
  return verifyToken(req);
}

/** Liste des emails administrateurs (variable d'env ADMIN_EMAILS, séparés par des virgules). */
export function adminEmails() {
  return String(process.env.ADMIN_EMAILS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

/** L'appelant est-il administrateur ? (jeton valide ET email dans ADMIN_EMAILS) */
export async function isAdmin(req) {
  const user = await getUser(req);
  if (!user?.email) return false;
  const list = adminEmails();
  // Si aucune liste n'est configurée, on refuse : mieux vaut bloquer que d'ouvrir
  // une élévation de privilèges à tout compte authentifié.
  if (!list.length) return false;
  return list.includes(String(user.email).toLowerCase());
}
