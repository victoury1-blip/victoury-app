/* Coordonnées du livreur Ozon récupérées pour une commande.
 *
 * IMPORTANT : ces infos appartiennent à un CODE D'ENVOI précis, pas à la
 * commande. Si le code change (correction manuelle, restauration Ozon), le
 * livreur mémorisé n'est plus le bon — on l'ignore et on le fait re-récupérer
 * via la fenêtre « Livraison ». Les anciens enregistrements (sans code) sont
 * traités comme périmés pour la même raison.
 *
 * On mémorise TOUS les codes qui désignent le même colis (celui affiché dans
 * l'app et celui renvoyé par Ozon, qui peuvent différer par le remplissage :
 * VICT0050 / VICT00050). Sinon l'info était considérée périmée à tort et le
 * bouton « Envoyer info » restait invisible.
 */

const norm = (v) => String(v || '').trim().toUpperCase();

export function ozonTn(order) {
  return norm(order?.trackingNumber || order?.ozoneTracking || order?.id);
}

/* Tous les codes acceptables pour cette commande. */
export function ozonTnSet(order) {
  return [order?.trackingNumber, order?.ozoneTracking, order?.id].map(norm).filter(Boolean);
}

export function getOzonDp(order) {
  if (!order?.id) return {};
  try {
    const dp = JSON.parse(localStorage.getItem(`ozone_dp_${order.id}`) || '{}');
    if (!dp || (!dp.name && !dp.phone)) return {};
    const stored = [dp.tn, ...(Array.isArray(dp.tns) ? dp.tns : [])].map(norm).filter(Boolean);
    if (!stored.length) return {}; // ancien format : code inconnu -> périmé
    const current = ozonTnSet(order);
    if (!stored.some(t => current.includes(t))) return {};
    return dp;
  } catch {
    return {};
  }
}

export function ozonDpPayload(order, name, phone, extraTns = []) {
  const tns = [...new Set([...ozonTnSet(order), ...extraTns.map(norm)].filter(Boolean))];
  return { name: name || '', phone: phone || '', tn: tns[0] || '', tns };
}
