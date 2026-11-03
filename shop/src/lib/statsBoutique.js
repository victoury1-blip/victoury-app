/* Calculs du tableau de bord de la boutique (/store) à partir des commandes
 * du site — séparés de l'affichage pour être testés. */

/** Même durée, juste avant : 3–9 nov → 27 oct–2 nov ; « Auj. » → hier. */
export function periodePrecedente(start, end) {
  const jours = Math.round((new Date(end).setHours(0, 0, 0, 0) - new Date(start).setHours(0, 0, 0, 0)) / 864e5) + 1;
  const s = new Date(start); s.setHours(0, 0, 0, 0); s.setDate(s.getDate() - jours);
  const e = new Date(start); e.setHours(0, 0, 0, 0); e.setMilliseconds(-1);
  return { start: s, end: e, jours };
}

/** Évolution en % (arrondie), ou null quand la période précédente est vide. */
export function variation(actuel, precedent) {
  const a = Number(actuel) || 0, p = Number(precedent) || 0;
  if (!p) return null;
  return Math.round(((a - p) / p) * 100);
}

/* Statuts de l'application regroupés en 4 issues lisibles. */
const LIVREES = new Set(['livre', 'echange_recu']);
const PERDUES = new Set(['annule', 'refuse', 'injoignable', 'black_liste', 'retour_recu', 'pret_retour']);
const ATTENTE = new Set(['nouveau', 'a_voir', 'en_attente', 'interesse', 'photo_whatsapp', 'dem_suivi', 'manque_stock',
  'reporter', 'pas_reponse', 'pas_rep_1', 'pas_rep_2', 'pas_rep_3', 'pas_rep_4', 'pas_rep_5']);

export function issueCommande(status) {
  const s = status || 'nouveau';
  if (LIVREES.has(s)) return 'livrees';
  if (PERDUES.has(s)) return 'perdues';
  if (ATTENTE.has(s)) return 'attente';
  return 'confirmees'; // confirmé, ramassage, expédié, chez le livreur, en suivi…
}

/** { attente, confirmees, livrees, perdues, caLivre } */
export function issuesCommandes(commandes) {
  const r = { attente: 0, confirmees: 0, livrees: 0, perdues: 0, caLivre: 0 };
  for (const o of commandes || []) {
    const k = issueCommande(o.status);
    r[k]++;
    if (k === 'livrees') r.caLivre += Number(o.price) || 0;
  }
  return r;
}

const articles = (o) => {
  const l = Array.isArray(o?.products) && o.products.length ? o.products : (o?.product?.name ? [o.product] : []);
  return l.filter(p => p?.name);
};

/** Nom sans la taille ni la couleur collées par certaines commandes (« X - L »). */
const nomModele = (n) => String(n || '').replace(/\s*[-–]\s*(XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL|\d{2})\s*$/i, '').trim();

/** Produits les plus commandés (quantités), et tailles les plus demandées. */
export function topProduits(commandes, limite = 8) {
  const prods = new Map(), tailles = new Map();
  for (const o of commandes || []) {
    for (const p of articles(o)) {
      const q = Number(p.qty) || 1;
      const nom = nomModele(p.name);
      prods.set(nom, (prods.get(nom) || 0) + q);
      const t = String(p.size || '').trim().toUpperCase();
      if (t) tailles.set(t, (tailles.get(t) || 0) + q);
    }
  }
  const tri = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]);
  return { produits: tri(prods).slice(0, limite), tailles: tri(tailles).slice(0, 8) };
}

/** Heure du Maroc (0–23) d'un horodatage. */
export function heureMaroc(d) {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Casablanca', hour: '2-digit', hour12: false }).format(d));
  return h === 24 ? 0 : h;
}

/** Nombre de commandes par heure de la journée : [{ heure: '0h', commandes }, … 24]. */
export function commandesParHeure(commandes, lireDate) {
  const n = Array(24).fill(0);
  for (const o of commandes || []) {
    const d = lireDate(o);
    if (d) n[heureMaroc(d)]++;
  }
  return n.map((c, h) => ({ heure: `${h}h`, commandes: c }));
}
