// Autorise une requête vers les endpoints Ozon si :
//  1) elle porte un jeton Supabase valide (« Authorization: Bearer <access_token> »), OU
//  2) elle provient de l'application elle-même (same-origin) — utile quand la vérification
//     du jeton n'est pas disponible côté serveur, sans casser la fonctionnalité.
// La navigation directe vers l'URL (sans Origin/Referer de l'app) et les appels
// tiers restent refusés.
// (Fichier préfixé « _ » : importable mais non exposé comme route.)

async function verifyToken(req) {
  try {
    const auth = req.headers['authorization'] || req.headers['Authorization'] || '';
    const m = /^Bearer\s+(.+)$/i.exec(String(auth).trim());
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

function isSameOrigin(req) {
  try {
    const host = req.headers['host'] || '';
    if (!host) return false;
    const src = req.headers['origin'] || req.headers['referer'] || '';
    if (!src) return false;               // navigation directe : pas d'Origin/Referer → refus
    let srcHost = '';
    try { srcHost = new URL(src).host; } catch { return false; }
    return srcHost === host;
  } catch { return false; }
}

export async function isAuthenticated(req) {
  // Le jeton Supabase est LA vérification : Origin/Referer sont forgeables
  // (curl, scripts) et ne suffisent pas seuls. Le repli same-origin n'est
  // utilisé que si la config Supabase manque côté serveur (sinon l'app
  // elle-même serait bloquée).
  const hasSupaEnv = !!((process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL) &&
                        (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY));
  if (hasSupaEnv) return verifyToken(req);
  return isSameOrigin(req);
}
