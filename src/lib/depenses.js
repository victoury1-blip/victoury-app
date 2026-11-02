/* Dépenses (pub Facebook / TikTok, livraison extra, autres) regroupées par
 * mois, pour la fenêtre « Dépenses » du Rapport de Profit. Le mois d'une
 * dépense est celui de sa date ('AAAA-MM-JJ'). */

const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

/** '2026-11' → 'Novembre 2026'. */
export function libelleMois(cle) {
  const [a, m] = String(cle || '').split('-');
  const i = Number(m) - 1;
  return MOIS[i] ? `${MOIS[i]} ${a}` : 'Sans date';
}

/** Mois précédent : '2026-01' → '2025-12'. */
export function moisPrecedent(cle) {
  const [a, m] = cle.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
}

/**
 * Regroupe les dépenses par mois, du plus récent au plus ancien.
 * → [{ cle, libelle, total, items (du plus récent au plus ancien), parCategorie: { [cat]: montant } }]
 */
export function grouperParMois(depenses) {
  const groupes = new Map();
  for (const d of depenses || []) {
    const cle = /^\d{4}-\d{2}/.test(d?.date || '') ? d.date.slice(0, 7) : 'sans-date';
    if (!groupes.has(cle)) groupes.set(cle, { cle, libelle: libelleMois(cle), total: 0, items: [], parCategorie: {} });
    const g = groupes.get(cle);
    const montant = Number(d.amount) || 0;
    const cat = d.category || 'facebook';
    g.total += montant;
    g.parCategorie[cat] = (g.parCategorie[cat] || 0) + montant;
    g.items.push(d);
  }
  const liste = [...groupes.values()];
  liste.forEach(g => g.items.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || (b.id || 0) - (a.id || 0)));
  return liste.sort((a, b) => (a.cle === 'sans-date') - (b.cle === 'sans-date') || b.cle.localeCompare(a.cle));
}
