/**
 * Convertit un libellé de statut (CSV, français/arabe/variantes) vers un statut de l'app.
 * Retourne null si non reconnu (on retombe alors sur le statut global choisi à l'import).
 */
export function mapToAppStatus(raw) {
  const t = String(raw || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  if (!t) return null;
  const has = (...ks) => ks.some(k => t.includes(k));
  if (has('livr', 'delivered', 'تسليم', 'توصيل', 'سلم')) return 'livre';
  if (has('refus', 'refused', 'rejet', 'رفض')) return 'refuse';
  if (has('annul', 'cancel', 'الغاء', 'ملغ')) return 'annule';
  if (has('echang', 'change', 'exchange', 'تبديل')) return 'change';
  if (has('retour', 'return', 'ارجاع', 'مرجع', 'رجع')) return 'retour_recu';
  if (has('confirm', 'مؤكد', 'تاكيد')) return 'confirme';
  if (has('expedi', 'expédi', 'shipped', 'شحن', 'مرسل')) return 'expedier';
  if (has('ramass', 'pickup', 'جمع')) return 'att_ramassage';
  if (has('pas rep', 'pas de rep', 'no answer', 'injoign', 'لم يرد', 'مايجاوب')) return 'pas_reponse';
  if (has('attente', 'pending', 'انتظار')) return 'en_attente';
  if (has('suivi', 'follow')) return 'en_suivi';
  if (has('nouveau', 'new', 'جديد')) return 'nouveau';
  return null;
}
