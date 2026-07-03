/** Fuseau horaire système (configurable dans Réglages), défaut Casablanca. */
export function getSysTz() {
  try {
    const raw = localStorage.getItem('system_timezone');
    return raw ? JSON.parse(raw) : 'Africa/Casablanca';
  } catch {
    return localStorage.getItem('system_timezone') || 'Africa/Casablanca';
  }
}

/** Horodatage formaté `jj/mm/aaaa hh:mm` dans le fuseau système. */
export function now() {
  return new Date()
    .toLocaleString('fr-FR', {
      timeZone: getSysTz(),
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
    .replace(',', '');
}
