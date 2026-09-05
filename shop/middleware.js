// Blocage complet du site pour une IP bloquée depuis /store/commandes —
// avant, seule la commande était ignorée en silence ; le visiteur pouvait
// toujours parcourir le catalogue normalement. Ici, la page elle-même ne
// se charge plus du tout pour cette IP.
//
// La liste est mise en cache en mémoire (process de la fonction edge) plutôt
// que revérifiée à chaque requête : un aller-retour Supabase sur CHAQUE
// visite, pour CHAQUE visiteur, casserait la vitesse du site pour gagner un
// blocage qui n'a besoin d'être exact qu'à quelques minutes près.

export const config = {
  matcher: '/((?!api/|assets/|icon|manifest|sw).*)',
};

let cache = { ips: new Set(), expire: 0 };

async function ipsBloquees() {
  if (Date.now() < cache.expire) return cache.ips;
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return cache.ips;
  // Un Supabase lent ou muet ne doit JAMAIS faire attendre chaque visiteur du
  // site — un fetch sans limite de temps a déjà suffi à rendre tout le site
  // inaccessible (ERR_CONNECTION_TIMED_OUT) le jour où la réponse a traîné.
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 1500);
  try {
    const r = await fetch(`${url}/rest/v1/rpc/shop_ips_bloquees_liste`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: '{}',
      signal: ac.signal,
    });
    if (r.ok) {
      const lignes = await r.json();
      cache = { ips: new Set((lignes || []).map(l => l.ip)), expire: Date.now() + 60_000 };
    }
    // Une réponse non-ok (erreur, quota, panne) ne doit jamais bloquer le
    // site pour tout le monde : on retente juste plus tôt (pas de cache
    // longue durée sur un échec) plutôt que de figer la liste précédente
    // pour 60s de plus si Supabase reste indisponible.
    else cache = { ...cache, expire: Date.now() + 5_000 };
  } catch {
    cache = { ...cache, expire: Date.now() + 5_000 };
  } finally {
    clearTimeout(to);
  }
  return cache.ips;
}

// Une page vide (403 sans corps) ressemble à un blocage volontaire — un
// visiteur qui la voit comprend vite qu'il est banni et change de
// wifi/4G pour recommencer. Une page d'erreur générique, plausible comme
// une vraie panne, ne pousse à rien de tel.
const PAGE_PANNE = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Site indisponible</title></head>
<body style="font-family:sans-serif;text-align:center;padding:80px 20px;color:#444">
<h1 style="font-size:20px">Ce site est temporairement indisponible</h1>
<p style="font-size:14px;color:#888">Merci de réessayer plus tard.</p>
</body></html>`;

export default async function middleware(request) {
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  if (ip && (await ipsBloquees()).has(ip)) {
    return new Response(PAGE_PANNE, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}
