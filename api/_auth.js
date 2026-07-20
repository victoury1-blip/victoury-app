// Vérifie qu'une requête provient d'un utilisateur authentifié de l'app (session Supabase).
// Le client envoie « Authorization: Bearer <access_token> » ; on valide le jeton auprès de
// Supabase. Sans configuration Supabase côté serveur, on ne peut pas vérifier → refus.
// (Fichier préfixé « _ » : importable mais non exposé comme route.)

export async function isAuthenticated(req) {
  try {
    const auth = req.headers['authorization'] || req.headers['Authorization'] || '';
    const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
    if (!m) return false;
    const token = m[1].trim();
    if (!token || token.length < 20) return false;

    const SUPA_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    if (!SUPA_URL || !ANON) return false;

    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 8000);
    try {
      const r = await fetch(`${SUPA_URL.replace(/\/$/, '')}/auth/v1/user`, {
        headers: { apikey: ANON, Authorization: `Bearer ${token}` },
        signal: ac.signal,
      });
      clearTimeout(t);
      if (!r.ok) return false;
      const u = await r.json();
      return !!(u && u.id);
    } catch { clearTimeout(t); return false; }
  } catch { return false; }
}
