/* Colis en danger : un colis Ozon encore en route dont le dernier statut
 * Ozon annonce un échec probable (client injoignable, numéro faux, adresse
 * manquante, refus, hors zone…). Contacter la cliente le jour même suffit
 * souvent à sauver la livraison — c'est le but de la page /colis-danger et
 * de la notification envoyée par le webhook Ozon (api/ozon-webhook.js).
 *
 * Module sans dépendance navigateur : importé aussi côté serveur. */

/* Dans l'ordre : la première règle qui correspond l'emporte. `niveau` 3 =
   à traiter tout de suite, 2 = aujourd'hui, 1 = à surveiller. */
const REGLES = [
  { re: /refus/i, type: 'refus', niveau: 3 },
  { re: /erreur\s*num/i, type: 'numero', niveau: 3 },
  { re: /sans\s*adres/i, type: 'adresse', niveau: 3 },
  { re: /j\s*\+\s*3/i, type: 'injoignable', niveau: 3 },
  { re: /pas\s*(de\s*)?r[ée]ponse/i, type: 'injoignable', niveau: 2 },
  { re: /hors[\s-]*(zone|secteur)|non[\s-]*couverte/i, type: 'zone', niveau: 2 },
  { re: /report/i, type: 'reporte', niveau: 1 },
];

/* Statuts de l'application où le colis est déjà réglé : plus rien à sauver. */
const STATUTS_TERMINES = new Set(['livre', 'refuse', 'annule', 'pret_retour', 'retour_recu', 'change', 'echange_recu']);

/** Risque d'un statut Ozon seul (libellé), ou null. */
export function risqueStatut(statutOzon) {
  const s = String(statutOzon || '');
  if (!s) return null;
  const r = REGLES.find(x => x.re.test(s));
  return r ? { type: r.type, niveau: r.niveau, statut: s } : null;
}

/** Risque d'une commande (forme de l'application : ozoneLastStatus, recipient…), ou null. */
export function risqueColis(o) {
  if (!o || o.isDeleted || STATUTS_TERMINES.has(o.status)) return null;
  if (!/ozon/i.test(o.recipient?.delivery || '')) return null;
  return risqueStatut(o.ozoneLastStatus);
}

/** Le colis a-t-il déjà été traité pour CE statut ? (un nouveau statut à risque le refait apparaître) */
export const dejaTraite = (o, traites) => !!traites && traites[o.id] === o.ozoneLastStatus;

const nomProduit = (o) => {
  const p = (o?.products?.length ? o.products : [o?.product]).filter(x => x?.name);
  return p.map(x => x.name).join(' + ');
};

/** Message WhatsApp adapté au problème. */
export function messageDanger(o, type) {
  const nom = (o?.recipient?.name || '').trim();
  const produit = nomProduit(o);
  const kolis = produit ? `الكولي ديالك (${produit})` : 'الكولي ديالك';
  const debut = `السلام عليكم${nom ? ' ' + nom : ''} 😊 معاك Victoury.`;
  const corps = {
    injoignable: `الليفرور حاول يتاصل بيك على ${kolis} وما جاوبتيش. واش نقولو ليه يدوز اليوم؟ عافاك جاوبي ملي يعيط ليك 🙏`,
    refus: `وصلنا أن ${kolis} ترفض. واش كاين شي مشكل نقدرو نعاونوك فيه (المقاس، اللون، الوقت)؟ نقدرو نبدلوه ليك ولا نعاودو نصيفطوه 🙏`,
    numero: `الليفرور ما قدرش يتاصل بيك فالنمرة اللي عطيتينا. عافاك أكدي لينا النمرة الصحيحة والعنوان باش يوصلك ${kolis} 🙏`,
    adresse: `الليفرور محتاج العنوان مضبوط باش يوصلك ${kolis}. عافاك صيفطي لينا العنوان كامل ولا اللوكاسيون 📍`,
    zone: `العنوان ديالك خارج المنطقة ديال الليفرور. واش عندك عنوان آخر قريب (خدمة، عائلة…) نصيفطو ليه ${kolis}؟`,
    reporte: `${kolis} تأجل. إمتى يناسبك نصيفطوه ليك؟`,
  }[type] || `بغينا نتأكدو معاك من ${kolis}. واش كلشي مزيان؟`;
  return `${debut}\n${corps}`;
}

export const LIBELLE_TYPE = {
  injoignable: 'Injoignable', refus: 'Refus', numero: 'Numéro faux',
  adresse: 'Adresse manquante', zone: 'Hors zone', reporte: 'Reporté',
};
