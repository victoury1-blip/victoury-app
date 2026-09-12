/* Localisation précise du client, si le navigateur l'accepte — bien plus
 * fiable que la géolocalisation par IP (voir api/commande.js) : les
 * opérateurs mobiles marocains sortent souvent par des passerelles
 * enregistrées en Europe, ce qui fausse toute déduction depuis l'IP.
 *
 * JAMAIS bloquant : ni la demande de permission, ni son refus, ni un
 * éventuel échec du service de reverse-geocoding ne doivent retarder ou
 * empêcher la commande. On lance la demande tôt (à l'arrivée sur la page)
 * pour qu'elle ait le temps d'aboutir avant que le client ne valide.
 */
function position() {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p.coords),
      () => resolve(null), // refusé, ou indisponible
      { timeout: 8000, maximumAge: 300000 }
    );
  });
}

async function reverseGeocode(lat, lon) {
  try {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 4000);
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=fr`, { signal: ac.signal });
    clearTimeout(to);
    if (!r.ok) return null;
    const d = await r.json();
    const ville = d.city || d.locality || null;
    const pays = d.countryName || null;
    return ville ? { ville, pays } : null;
  } catch {
    return null;
  }
}

/** Résout vers {ville, pays} si le client accepte et que le service répond, sinon null. */
export async function localiserClient() {
  const coords = await position();
  if (!coords) return null;
  return reverseGeocode(coords.latitude, coords.longitude);
}
