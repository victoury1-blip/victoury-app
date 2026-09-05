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
  try {
    const r = await fetch(`${url}/rest/v1/rpc/shop_ips_bloquees_liste`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: '{}',
    });
    if (r.ok) {
      const lignes = await r.json();
      cache = { ips: new Set((lignes || []).map(l => l.ip)), expire: Date.now() + 60_000 };
    }
  } catch { /* liste précédente conservée plutôt qu'un site cassé pour tout le monde */ }
  return cache.ips;
}

export default async function middleware(request) {
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  if (ip && (await ipsBloquees()).has(ip)) {
    return new Response(null, { status: 403 });
  }
}
