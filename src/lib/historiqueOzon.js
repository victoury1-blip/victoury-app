/* Passé d'un numéro chez Ozon : parmi les colis envoyés par Ozon depuis
 * l'application, combien Ozon a marqués « Livré » et combien « Retourné »
 * (refusé / annulé / retour). On lit le DERNIER STATUT OZON du colis
 * (ozoneLastStatus, rapatrié par le suivi Ozon), pas le statut de l'appli.
 * L'API officielle d'Ozon n'a pas de recherche par téléphone : les colis
 * créés directement sur le site d'Ozon n'y figurent donc pas. */

export const cle9 = (t) => String(t || '').replace(/\D/g, '').slice(-9);

const estOzon = (o) => !!o?.ozoneTracking || /ozon/i.test(o?.recipient?.delivery || '');

/** 'livre' | 'retourne' | 'encours' d'après le libellé Ozon. */
export function issueOzon(statut) {
  const s = String(statut || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (!s) return 'encours';
  if (/retour|refus|annul/.test(s)) return 'retourne';
  if (/non\s+livr/.test(s)) return 'encours';
  if (/\blivre(e|s)?\b/.test(s) || /\bdelivered\b/.test(s)) return 'livre';
  return 'encours';
}

/** { livres, retournes, encours, total } — sans la commande `exclureId`. */
export function historiqueOzon(orders, telephone, exclureId) {
  const cle = cle9(telephone);
  const r = { livres: 0, retournes: 0, encours: 0, total: 0 };
  if (cle.length < 9) return r;
  for (const o of orders || []) {
    if (!o || o.id === exclureId || o.isDeleted || o.is_deleted || !estOzon(o)) continue;
    if (cle9(o.recipient?.phone) !== cle) continue;
    r.total++;
    const k = issueOzon(o.ozoneLastStatus);
    if (k === 'livre') r.livres++;
    else if (k === 'retourne') r.retournes++;
    else r.encours++;
  }
  return r;
}
