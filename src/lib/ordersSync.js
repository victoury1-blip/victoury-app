/* Synchronisation des commandes — chargement local d'abord, puis delta.
 *
 * L'application relisait l'INTÉGRALITÉ des commandes (des milliers de lignes,
 * avec leurs objets `recipient` / `products`) à chaque ouverture ET à chaque
 * retour au premier plan. C'est ce qui a épuisé le quota de bande passante.
 *
 * Désormais :
 *   1. l'écran s'affiche immédiatement depuis le cache IndexedDB ;
 *   2. on ne demande à la base qu'une EMPREINTE (7 petites colonnes) de chaque
 *      commande ;
 *   3. seules les lignes dont l'empreinte a changé sont rapatriées en entier.
 *
 * Dans le cas courant — rien n'a bougé — le transfert se limite à l'empreinte,
 * soit environ vingt fois moins de données.
 */

/** Colonnes réellement lues par `mapRow`. `*` transférait des champs inutilisés. */
export const ORDER_COLUMNS =
  'id, recipient, product, products, price, status, note, date_added, date_updated, ' +
  'validated, echange, report_date, note_livraison, tracking_number, ozone_tracking, ' +
  'ozone_last_status, manually_modified, recu, created_at';

/* Colonnes suffisantes pour détecter un changement. `is_deleted` est inclus :
   la liste noire des suppressions se déduit de la même requête, ce qui supprime
   l'ancienne requête séparée sur les commandes supprimées. */
const FP_COLUMNS = 'id, status, date_updated, tracking_number, validated, recu, is_deleted';

const PAGE = 1000;

/* Un booléen vaut tantôt `null` en base et `false` après `mapRow` ; une chaîne
   vide devient `null`. Sans normalisation, ces équivalents feraient croire à un
   changement et déclencheraient un rapatriement complet à chaque synchro. */
const s = (v) => (v == null ? '' : String(v));
const b = (v) => (v ? '1' : '0');

/** Empreinte d'une ligne telle que renvoyée par la base. */
export function fpRow(r) {
  return `${s(r.status)}|${s(r.date_updated)}|${s(r.tracking_number)}|${b(r.validated)}|${b(r.recu)}`;
}

/** Empreinte d'une commande telle que stockée dans le cache local. */
export function fpCached(o) {
  return `${s(o.status)}|${s(o.dateUpdated)}|${s(o.trackingNumber)}|${b(o.validated)}|${b(o.recu)}`;
}

/* Pagination : Supabase plafonne chaque requête à 1000 lignes. Le tri porte sur
   une clé UNIQUE (created_at + id) — sans départage, un lot importé au même
   instant rend les frontières de page ambiguës et duplique ou saute des lignes. */
async function paginate(supabase, columns, applyFilter) {
  let all = [];
  let from = 0;
  while (true) {
    let q = supabase.from('orders').select(columns);
    if (applyFilter) q = applyFilter(q);
    const res = await q
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + PAGE - 1);
    if (res.error) return { error: res.error };
    const batch = res.data || [];
    all = all.concat(batch);
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  // Dédoublonnage de sécurité : une insertion concurrente peut décaler les pages.
  const seen = new Set();
  return { rows: all.filter((o) => (seen.has(o.id) ? false : seen.add(o.id))) };
}

/** Empreintes de TOUTES les commandes, supprimées comprises. */
export function fetchFingerprints(supabase) {
  return paginate(supabase, FP_COLUMNS, null);
}

/** Toutes les commandes actives, en entier (premier chargement, cache absent). */
export function fetchAllOrders(supabase) {
  // `neq('is_deleted', true)` exclurait les lignes où is_deleted IS NULL
  // (NULL <> true vaut NULL) : on inclut explicitement NULL et false.
  return paginate(supabase, ORDER_COLUMNS, (q) => q.or('is_deleted.is.null,is_deleted.eq.false'));
}

/** Lignes complètes pour une liste d'ids, par paquets (limite d'URL). */
export async function fetchOrdersByIds(supabase, ids) {
  const CHUNK = 200;
  const out = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const res = await supabase
      .from('orders')
      .select(ORDER_COLUMNS)
      .in('id', ids.slice(i, i + CHUNK));
    if (res.error) return { error: res.error };
    out.push(...(res.data || []));
  }
  return { rows: out };
}

/** Ids à rapatrier : absents du cache, ou dont l'empreinte a changé. */
export function staleIds(fpRows, cacheById) {
  const out = [];
  for (const r of fpRows) {
    const cached = cacheById.get(r.id);
    if (!cached || fpCached(cached) !== fpRow(r)) out.push(r.id);
  }
  return out;
}
