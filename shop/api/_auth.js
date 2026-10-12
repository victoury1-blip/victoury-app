// Autorisation des endpoints serveur de la boutique.
//
// RÈGLE : seul un jeton Supabase valide autorise l'accès. Les en-têtes
// Origin/Referer sont librement falsifiables hors navigateur (curl), donc
// jamais utilisés seuls pour protéger un endpoint.
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

/** Jeton Supabase valide obligatoire. */
export async function isAuthenticated(req) {
  return !!(await getUser(req));
}
