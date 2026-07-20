/**
 * Convertit un libellé de statut (CSV, français/arabe/variantes) vers un statut de l'app.
 * Retourne null si non reconnu (on retombe alors sur le statut global choisi à l'import).
 *
 * Couvre les valeurs des listes déroulantes Google Sheets :
 *  - Confirmation : CONFIRME, ECHANGE, PAS R.1, PAS R.2, INJOIGNABLE, EN ATTENTE,
 *                   ANNULE, ERROR, CONFIRME OUT STOCK
 *  - Livraison    : Ramassé, Expédié, LIVRE, RETOUR, Reporté, OUT STOCK, RECU
 */
export function mapToAppStatus(raw) {
  const t = String(raw || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  if (!t) return null;
  const has = (...ks) => ks.some(k => t.includes(k));

  // Rupture / hors stock — avant "confirme" car la valeur "CONFIRME OUT STOCK" contient les deux.
  if (has('out stock', 'outstock', 'out of stock', 'rupture', 'manque', 'نفاد', 'مخزون')) return 'manque_stock';
  // Tokens combinés / spécifiques AVANT les tokens simples : « retour reçu » doit
  // donner retour_recu et non recu_livreur ; l'échange et le retour avant « livr »/« recu ».
  if (has('echang', 'chang', 'exchange', 'تبديل')) return 'change';
  if (has('retour', 'return', 'ارجاع', 'مرجع', 'رجع')) return 'retour_recu';
  if (has('livr', 'delivered', 'تسليم', 'توصيل', 'سلم')) return 'livre';
  if (has('recu', 'received', 'توصل')) return 'recu_livreur';
  if (has('refus', 'refused', 'rejet', 'رفض')) return 'refuse';
  if (has('annul', 'cancel', 'الغاء', 'ملغ')) return 'annule';
  if (has('report', 'تأجيل', 'مؤجل')) return 'reporter';
  if (has('confirm', 'مؤكد', 'تاكيد')) return 'confirme';
  if (has('expedi', 'shipped', 'شحن', 'مرسل')) return 'expedier';
  if (has('ramass', 'pickup', 'جمع')) return 'att_ramassage';
  if (has('injoign', 'unreachable', 'غير متاح', 'لا يمكن الوصول')) return 'injoignable';
  // Pas de réponse — avec numéro éventuel (PAS R.1 / PAS R.2 …).
  if (has('pas r', 'pas.r', 'pasr', 'p.r', 'pas de rep', 'no answer', 'لم يرد', 'مايجاوب')) {
    if (t.includes('5')) return 'pas_rep_5';
    if (t.includes('4')) return 'pas_rep_4';
    if (t.includes('3')) return 'pas_rep_3';
    if (t.includes('2')) return 'pas_rep_2';
    return 'pas_rep_1';
  }
  if (has('attente', 'pending', 'انتظار')) return 'en_attente';
  if (has('suivi', 'follow')) return 'en_suivi';
  if (has('nouveau', 'new', 'جديد')) return 'nouveau';
  return null;
}
