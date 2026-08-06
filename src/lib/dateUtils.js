/** Fuseau horaire système (configurable dans Réglages), défaut Casablanca. */
export function getSysTz() {
  try {
    const raw = localStorage.getItem('system_timezone');
    return raw ? JSON.parse(raw) : 'Africa/Casablanca';
  } catch {
    return localStorage.getItem('system_timezone') || 'Africa/Casablanca';
  }
}

/** Formate une date au format de l'app `jj/mm/aaaa hh:mm:ss`, dans le fuseau
 *  SYSTÈME configuré. À utiliser pour tout horodatage ENREGISTRÉ : passer par
 *  `toLocaleString('fr-MA')` prend le fuseau de l'appareil, si bien que deux
 *  appareils dans des fuseaux différents écrivent des heures incohérentes et le
 *  tri « dernière mise à jour en tête » se retrouve faux. */
export function fmtDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  return d
    .toLocaleString('fr-FR', {
      timeZone: getSysTz(),
      day: '2-digit', month: '2-digit', year: 'numeric',
      // Secondes incluses : tri « dernière commande mise à jour en tête » précis
      // même pour deux mises à jour dans la même minute.
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    })
    .replace(',', '');
}

/** Horodatage courant au format de l'app, dans le fuseau système. */
export function now() {
  return fmtDate(new Date());
}
