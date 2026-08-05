/* Coordonnées du livreur Ozon récupérées pour une commande.
 *
 * IMPORTANT : ces infos appartiennent à un CODE D'ENVOI précis, pas à la
 * commande. Si le code change (correction manuelle, restauration Ozon), le
 * livreur mémorisé n'est plus le bon — on l'ignore et on le fait re-récupérer
 * via la fenêtre « Livraison ». Les anciens enregistrements (sans code) sont
 * traités comme périmés pour la même raison.
 */

export function ozonTn(order) {
  return String(order?.trackingNumber || order?.ozoneTracking || order?.id || '');
}

export function getOzonDp(order) {
  if (!order?.id) return {};
  try {
    const dp = JSON.parse(localStorage.getItem(`ozone_dp_${order.id}`) || '{}');
    if (!dp || (!dp.name && !dp.phone)) return {};
    if (!dp.tn || dp.tn !== ozonTn(order)) return {};
    return dp;
  } catch {
    return {};
  }
}

export function ozonDpPayload(order, name, phone) {
  return { name: name || '', phone: phone || '', tn: ozonTn(order) };
}
