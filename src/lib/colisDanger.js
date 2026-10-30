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
  { re: /programm/i, type: 'programme', niveau: 1 },
];

/** Première date trouvée dans un texte (« 2026-10-31 », « 31/10/2026 », « 31-10-2026 »), en 'AAAA-MM-JJ'. */
export function extraireDate(texte) {
  const t = String(texte || '');
  let m = /(20\d{2})-(\d{2})-(\d{2})/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /(\d{1,2})[/-](\d{1,2})[/-](20\d{2})/.exec(t);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

/* Statuts qui annoncent un passage à une date donnée (Reporté, Programmé) :
   la date prévue fait partie de l'information utile. */
export const STATUT_DATE = /report|programm/i;

/** Ajoute la date au libellé quand il n'en porte pas encore : « Programmé 2026-10-31 ». */
export function libelleAvecDate(statut, date) {
  if (!statut || !date || !STATUT_DATE.test(statut) || extraireDate(statut)) return statut;
  return `${statut} ${date}`;
}

/** « 2026-10-31 » → « 31/10 ». */
export const jourMois = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '');

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
export function messageDanger(o, type, date = extraireDate(o?.ozoneLastStatus)) {
  const nom = (o?.recipient?.name || '').trim();
  const produit = nomProduit(o);
  const kolis = produit ? `الكولي ديالك (${produit})` : 'الكولي ديالك';
  const debut = `السلام عليكم${nom ? ' ' + nom : ''} 😊 معاك Victoury.`;
  const corps = {
    injoignable: `الليفرور حاول يتاصل بيك على ${kolis} وما جاوبتيش. واش نقولو ليه يدوز اليوم؟ جاوبي ملي يعيط ليك 🙏`,
    refus: `وصلنا أن ${kolis} ترفض. واش كاين شي مشكل نقدرو نعاونوك فيه (المقاس، اللون، الوقت)؟ نقدرو نبدلوه ليك ولا نعاودو نصيفطوه 🙏`,
    numero: `الليفرور ما قدرش يتاصل بيك فالنمرة اللي عطيتينا. أكدي لينا النمرة الصحيحة والعنوان باش يوصلك ${kolis} 🙏`,
    adresse: `الليفرور محتاج العنوان مضبوط باش يوصلك ${kolis}. صيفطي لينا العنوان كامل ولا اللوكاسيون 📍`,
    zone: `العنوان ديالك خارج المنطقة ديال الليفرور. واش عندك عنوان آخر قريب (خدمة، عائلة…) نصيفطو ليه ${kolis}؟`,
    reporte: date
      ? `${kolis} تأجل لنهار ${jourMois(date)}. واش هاد النهار مناسب ليك؟ ولا بغيتيه قبل؟`
      : `${kolis} تأجل. إمتى يناسبك نصيفطوه ليك؟`,
    programme: date
      ? `${kolis} مبرمج يوصلك نهار ${jourMois(date)} 📅 غير بغينا نتأكدو أنك غتكوني موجودة وتجاوبي الليفرور 😊`
      : `${kolis} مبرمج يوصلك قريب 📅 غير بغينا نتأكدو أنك غتكوني موجودة وتجاوبي الليفرور 😊`,
  }[type] || `بغينا نتأكدو معاك من ${kolis}. واش كلشي مزيان؟`;
  return `${debut}\n${corps}`;
}

/** Message WhatsApp au livreur qui a le colis : qui, où, quoi, et la demande. */
export function messageLivreur(o, livreur) {
  const r = o?.recipient || {};
  const produit = nomProduit(o);
  return [
    `السلام عليكم${livreur?.nom ? ' ' + livreur.nom : ''} 👋`,
    'معاك فريق Victoury، كنتواصل معاك على هاد الكوموند:',
    `👤 ${r.name || 'الكليانة'}`,
    r.phone ? `📞 ${r.phone}` : '',
    r.city || r.address ? `📍 ${[r.city, r.address].filter(Boolean).join(' — ')}` : '',
    `📦 ${o?.trackingNumber || o?.id}${produit ? ` — ${produit}` : ''}`,
    o?.ozoneLastStatus ? `📌 الحالة: ${o.ozoneLastStatus}` : '',
    '',
    'الكليانة كتسنى الكولي ديالها. واش تقدر تعاود تعيط ليها وتدوز عندها اليوم؟ وإلا كان شي مشكل قولو لينا ونحلوه معاها 🙏',
    'شكرا بزاف 🌸',
  ].filter((l, i, a) => l !== '' || (i > 0 && a[i - 1] !== '')).join('\n');
}

export const LIBELLE_TYPE = {
  injoignable: 'Injoignable', refus: 'Refus', numero: 'Numéro faux',
  adresse: 'Adresse manquante', zone: 'Hors zone', reporte: 'Reporté', programme: 'Programmé',
};
