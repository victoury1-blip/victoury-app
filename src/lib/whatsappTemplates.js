const DEFAULT_TEMPLATES = {
  confirme: {
    enabled: true,
    message: `‏✅ سلام {name} ،
‏الطلب ديالك رقم {tracking} تأكد ✅
‏💰 الثمن : {price} درهم
*‏غادي نتواصلو معاك قريب للتوصيل إن شاء الله.*`,
  },
  expedier: {
    enabled: true,
    message: `‏✅ سلام {name} ،
‏الطلب ديالك رقم {tracking}
‏🛵 خداه ليفرور {livreur}.
*‏📲 رقم هاتف ليفرور: {livreurPhone}*
‏💰 الثمن : {price} درهم التوصيل فابور
*‏غادي يتواصل معاك اليوم إن شاء الله.*`,
  },
  ramasse: {
    enabled: true,
    message: `‏✅ سلام {name} ،
‏الطلب ديالك رقم {tracking} تجمع من المخزن 📦
‏🛵 ليفرور: {livreur}
*‏📲 رقم هاتف ليفرور: {livreurPhone}*
‏💰 الثمن : {price} درهم
*‏غادي يتواصل معاك قريب إن شاء الله.*`,
  },
  recu_livreur: {
    enabled: true,
    message: `‏✅ سلام {name} ،
‏الطلب ديالك رقم {tracking} وصل عند الليفرور 🚚
‏🛵 ليفرور: {livreur}
*‏📲 رقم هاتف ليفرور: {livreurPhone}*
‏💰 الثمن : {price} درهم
*‏غادي يتواصل معاك اليوم إن شاء الله.*`,
  },
  livre: {
    enabled: false,
    message: `‏✅ سلام {name} ،
‏الطلب ديالك رقم {tracking} توصل بنجاح ✅🎉
‏شكراً على ثقتك فينا! 🙏
*‏إلا كان شي مشكل، تواصل معانا.*`,
  },
};

const WA_CONFIG_KEY = 'victoury_wa_templates';

export function getWaTemplates() {
  try {
    const stored = JSON.parse(localStorage.getItem(WA_CONFIG_KEY) || '{}');
    const merged = {};
    for (const key of Object.keys(DEFAULT_TEMPLATES)) {
      merged[key] = { ...DEFAULT_TEMPLATES[key], ...stored[key] };
    }
    return merged;
  } catch {
    return { ...DEFAULT_TEMPLATES };
  }
}

export function saveWaTemplates(templates) {
  localStorage.setItem(WA_CONFIG_KEY, JSON.stringify(templates));
  import('./cloudSettings').then(({ cloudSet }) => cloudSet(WA_CONFIG_KEY, templates));
}

export function buildWhatsappMessage(order, status) {
  const templates = getWaTemplates();
  const tpl = templates[status];
  if (!tpl?.enabled || !tpl?.message) return null;
  if (!order.recipient?.phone) return null;

  const livreurs = (() => { try { return JSON.parse(localStorage.getItem('livreurs') || '[]'); } catch { return []; } })();
  const livreur = livreurs.find(l => l.nom === order.recipient?.delivery);
  const dp = (() => { try { return JSON.parse(localStorage.getItem(`ozone_dp_${order.id}`) || '{}'); } catch { return {}; } })();
  // On envoie au client le code AFFICHÉ dans l'application (`trackingNumber || id`),
  // pas l'ancien code Ozon : sinon une correction manuelle du « Code d'envoi » reste
  // sans effet sur le message et le client reçoit un numéro obsolète.
  const tn = order.trackingNumber || order.ozoneTracking || order.id;
  const isOzon = /ozon/i.test(order.recipient?.delivery || '');
  // Le livreur annoncé au client doit être CELUI de la commande :
  //  - livraison Ozon  -> l'agent Ozon réel (récupéré via la fenêtre Livraison) ;
  //  - livreur PERSONNEL -> celui de la liste des livreurs. On n'utilise JAMAIS
  //    l'agent Ozon dans ce cas (sinon le client reçoit le nom/numéro d'un livreur
  //    Ozon alors que le colis est confié à un livreur personnel).
  const livreurName = isOzon
    ? (dp.name || order.recipient?.delivery || '')
    : (livreur?.nom || order.recipient?.delivery || '');
  const livreurPhone = isOzon
    ? (dp.phone || '')
    : (livreur?.telephone || '');

  const msg = tpl.message
    .replace(/\{name\}/g, order.recipient.name || '')
    .replace(/\{tracking\}/g, tn)
    .replace(/\{price\}/g, order.price || '0')
    .replace(/\{livreur\}/g, livreurName)
    .replace(/\{livreurPhone\}/g, livreurPhone)
    .replace(/\{city\}/g, order.recipient?.city || '')
    .replace(/\{address\}/g, order.recipient?.address || '');

  const phone = order.recipient.phone.replace(/\s+/g, '').replace(/^0/, '212');

  return { phone, msg, name: order.recipient.name, orderId: order.id };
}

export const STATUS_LABELS_AR = {
  confirme: 'تأكيد الطلب',
  expedier: 'تم الإرسال',
  ramasse: 'تم الجمع',
  recu_livreur: 'وصل عند الليفرور',
  livre: 'تم التوصيل',
};

export const TEMPLATE_VARS = [
  { var: '{name}', label: 'اسم الكليان' },
  { var: '{tracking}', label: 'رقم التتبع' },
  { var: '{price}', label: 'الثمن' },
  { var: '{livreur}', label: 'اسم الليفرور' },
  { var: '{livreurPhone}', label: 'هاتف الليفرور' },
  { var: '{city}', label: 'المدينة' },
];
