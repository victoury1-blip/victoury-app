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

/* Couleur du client d'après son passé (livré / retourné), pour décider
 * d'un coup d'œil avant d'expédier :
 *  - vert   : il se fait livrer (aucun retour, ou au moins 75 % livrés) ;
 *  - rouge  : il renvoie (jamais livré, ou plus de retours que de livrés) ;
 *  - orange : entre les deux (des retours, mais il se fait livrer aussi) ;
 *  - neutre : nouveau numéro, rien à juger. */
export function niveauClientOzon(livres, retournes) {
  const l = Number(livres) || 0, r = Number(retournes) || 0;
  const total = l + r;
  if (!total) return { niveau: 'nouveau', taux: null };
  const taux = Math.round((l / total) * 100);
  if (r === 0 || taux >= 75) return { niveau: 'vert', taux };
  if (l === 0 || r > l) return { niveau: 'rouge', taux };
  return { niveau: 'orange', taux };
}
