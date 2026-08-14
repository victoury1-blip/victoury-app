/* Rapprochement des noms de villes marocaines.
 *
 * Le même lieu s'écrit rarement pareil d'une source à l'autre : la commande
 * porte « Ain atik » là où le transporteur liste « Ain Atiq ». Sans
 * normalisation, aucun tarif n'est trouvé, le frais de livraison reste à zéro
 * et la marge de la commande est fausse — silencieusement.
 *
 * On ne rapproche que ce qui relève de la TRANSCRIPTION de l'arabe, jamais deux
 * villes différentes : q/k, ou/u, gu/g, doubles lettres, accents, tirets.
 */
export function normalizeCity(name) {
  return (name || '')
    .toLowerCase()
    .trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // accents
    .replace(/[-_\s']/g, '')                            // séparateurs
    .replace(/ou/g, 'u')                                // Ouarzazate / Uarzazate
    .replace(/gu/g, 'g')                                // Guelmim / Gelmim
    .replace(/q/g, 'k')                                 // Atiq / Atik, Souq / Souk
    .replace(/y/g, 'i')                                 // Ayt / Ait
    .replace(/(.)\1+/g, '$1');                          // Settat / Setat
}

/** Le tarif correspondant à une commande, ou null si la ville est inconnue. */
export function findCityRow(fraisList, city) {
  if (!fraisList?.length || !city) return null;
  const cn = String(city).toLowerCase().trim();
  const cnN = normalizeCity(city);
  if (!cnN) return null;
  /* 1. Exact */
  let row = fraisList.find(c => (c.ville || '').toLowerCase().trim() === cn);
  /* 2. Normalisé */
  if (!row) row = fraisList.find(c => normalizeCity(c.ville) === cnN);
  /* 3. Partiel, sur les noms normalisés — en dernier recours seulement, et
        jamais sur un fragment de moins de 4 caractères : « Fes » se retrouverait
        sinon à l'intérieur de « Fes Meknes » comme de n'importe quel autre nom
        qui le contient. */
  if (!row && cnN.length >= 4) {
    row = fraisList.find(c => {
      const v = normalizeCity(c.ville);
      return v.length >= 4 && (v.includes(cnN) || cnN.includes(v));
    });
  }
  return row || null;
}

/** Tarif applicable : un échange se facture au tarif « change », même livré. */
export function feeFromRow(row, status, isEchange) {
  if (!row) return null;
  if (isEchange) return row.change ?? row.livre ?? null;
  if (status === 'livre') return row.livre ?? null;
  if (status === 'refuse') return row.refuse ?? null;
  if (status === 'annule') return row.annule ?? null;
  if (status === 'change') return row.change ?? null;
  return row.livre ?? null;
}
