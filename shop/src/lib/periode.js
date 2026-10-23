/* Périodes de comparaison avec Meta (jour, veille, mois…), en heure locale :
 * c'est le découpage qu'affiche le Gestionnaire de publicités. */

export const PERIODES = [
  { id: 'aujourdhui', label: "Aujourd'hui" },
  { id: 'hier', label: 'Hier' },
  { id: '7j', label: '7 jours' },
  { id: 'mois', label: 'Ce mois' },
  { id: 'mois_dernier', label: 'Mois dernier' },
  { id: 'tout', label: 'Tout' },
];

/** Bornes [début, fin[ en millisecondes, ou null pour « Tout ». */
export function bornesPeriode(id, maintenant = new Date()) {
  const d = new Date(maintenant);
  const jour = (y, m, j) => new Date(y, m, j).getTime();
  const y = d.getFullYear(), m = d.getMonth(), j = d.getDate();
  switch (id) {
    case 'aujourdhui': return [jour(y, m, j), jour(y, m, j + 1)];
    case 'hier': return [jour(y, m, j - 1), jour(y, m, j)];
    case '7j': return [jour(y, m, j - 6), jour(y, m, j + 1)];
    case 'mois': return [jour(y, m, 1), jour(y, m + 1, 1)];
    case 'mois_dernier': return [jour(y, m - 1, 1), jour(y, m, 1)];
    default: return null;
  }
}

/** « JJ/MM/AAAA HH:MM:SS » → millisecondes (0 si illisible). */
export function dateCommande(s) {
  const t = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!t) return 0;
  return new Date(+t[3], +t[2] - 1, +t[1], +(t[4] || 0), +(t[5] || 0), +(t[6] || 0)).getTime();
}

export function dansPeriode(dateAdded, id, maintenant = new Date()) {
  const b = bornesPeriode(id, maintenant);
  if (!b) return true;
  const t = dateCommande(dateAdded);
  return t >= b[0] && t < b[1];
}
