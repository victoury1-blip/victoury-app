/* Conversions API de Meta — ce que la publicité doit vraiment apprendre.
 *
 * Depuis le site, Meta ne voit que la commande PASSÉE. En paiement à la
 * livraison, une part importante est ensuite annulée, injoignable ou refusée :
 * l'algorithme optimise donc sur des ventes qui n'ont pas eu lieu, et va
 * chercher des gens qui remplissent des formulaires plutôt que des gens qui
 * paient.
 *
 * On renvoie ici l'issue RÉELLE de chaque commande. Les données personnelles
 * sont hachées dans le navigateur : ni notre serveur ni Meta ne voient un
 * numéro en clair.
 */
import { normalizePhone } from './phoneUtils';

const KEY = 'meta_capi_config';

export function getMetaConfig() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null') || {};
  } catch {
    return {};
  }
}

export function saveMetaConfig(cfg) {
  const clean = {
    enabled: !!cfg.enabled,
    pixelId: String(cfg.pixelId || '').replace(/\D/g, ''),
    token: String(cfg.token || '').trim(),
    testCode: String(cfg.testCode || '').trim(),
    sourceUrl: String(cfg.sourceUrl || '').trim(),
  };
  localStorage.setItem(KEY, JSON.stringify(clean));
  return clean;
}

/** Empreinte SHA-256 en minuscules, telle que Meta l'attend. */
async function sha256(value) {
  const data = new TextEncoder().encode(String(value));
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/* Meta exige une normalisation AVANT hachage : minuscules, sans espace ni
   ponctuation. Deux écritures du même client donneraient sinon deux empreintes
   différentes, et le rapprochement échouerait. */
const clean = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

/** Numéro au format international sans « + », seule forme acceptée par Meta. */
export function phoneForMeta(phone) {
  const n = normalizePhone(phone);
  if (!n) return '';
  return n.startsWith('0') ? '212' + n.slice(1) : n.replace(/\D/g, '');
}

/* Meta note la qualité du rapprochement : plus il y a de signaux concordants,
 * mieux une conversion est attribuée à une personne réelle — et mieux la
 * publicité apprend. Le téléphone seul plafonne bas ; l'adresse e-mail est le
 * signal le plus fort, et l'identifiant stable permet de relier entre eux les
 * évènements d'un même client. */
/** Données d'identification du client, entièrement hachées. */
export async function hashUserData(order) {
  const r = order?.recipient || {};
  const out = {};
  const ph = phoneForMeta(r.phone);
  if (ph) {
    out.ph = [await sha256(ph)];
    /* Identifiant stable, dérivé du téléphone : il relie les évènements d'un
       même client (achat, annulation) sans rien révéler de plus. */
    out.external_id = [await sha256(`victoury:${ph}`)];
  }
  const email = String(r.email || '').trim().toLowerCase();
  if (email.includes('@')) out.em = [await sha256(email)];
  // Le nom complet est découpé : Meta compare prénom et nom séparément.
  const parts = String(r.name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length) {
    out.fn = [await sha256(clean(parts[0]))];
    if (parts.length > 1) out.ln = [await sha256(clean(parts.slice(1).join('')))];
  }
  if (r.city) out.ct = [await sha256(clean(r.city))];
  out.country = [await sha256('ma')];
  return out;
}

/* Correspondance statut → évènement.
 *
 * `Purchase` n'est émis QUE sur une livraison : c'est le seul moment où l'argent
 * est réellement encaissé, et c'est précisément ce qu'on veut apprendre à Meta.
 * La confirmation est un signal intermédiaire, l'annulation un signal négatif. */
export const EVENT_BY_STATUS = {
  livre: { name: 'Purchase', withValue: true },
  echange_recu: { name: 'Purchase', withValue: true },
  confirme: { name: 'Lead', withValue: false },
  annule: { name: 'OrderCancelled', withValue: false },
  injoignable: { name: 'OrderCancelled', withValue: false },
  refuse: { name: 'OrderRefused', withValue: false },
};

/** Y a-t-il un évènement à envoyer pour ce statut ? */
export const eventForStatus = (status) => EVENT_BY_STATUS[status] || null;

/** Identifiant d'évènement — sert à Meta pour ne pas compter deux fois la même
 *  conversion si le pixel du site l'a déjà signalée. */
export const eventId = (order, eventName) => `${order.id}:${eventName}`;

/* Fenêtre acceptée par Meta : au-delà de sept jours, l'évènement est rejeté.
   On reste à six pour garder une marge. */
export const MAX_AGE_MS = 6 * 24 * 60 * 60 * 1000;

/** Date du dernier changement de statut, en millisecondes. */
export function orderTimestamp(order) {
  const raw = order?.dateUpdated || order?.dateAdded || '';
  const m = String(raw).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +(m[6] || 0)).getTime();
  const d = order?.createdAt ? new Date(order.createdAt).getTime() : NaN;
  return Number.isFinite(d) ? d : NaN;
}

/* Instant de l'évènement : celui de la LIVRAISON, pas celui de l'envoi.
 *
 * Horodater à l'envoi reportait sur aujourd'hui toutes les livraisons des jours
 * précédents : vingt et un achats affichés le jour où deux commandes seulement
 * étaient arrivées. Le chiffre est juste, la date ne l'est pas — et c'est la
 * date qui sert à rapprocher une vente de la dépense publicitaire du jour.
 *
 * Borné des deux côtés : Meta refuse un horodatage en avance, et tout ce qui
 * dépasse sa fenêtre. */
export function eventTime(order, now = Date.now()) {
  const t = orderTimestamp(order);
  if (!Number.isFinite(t)) return Math.floor(now / 1000);
  return Math.floor(Math.min(Math.max(t, now - MAX_AGE_MS), now) / 1000);
}

/** Construit l'évènement Meta d'une commande, ou null si son statut n'en a pas. */
export async function buildEvent(order, cfg = {}) {
  const spec = eventForStatus(order?.status);
  if (!spec) return null;
  const ev = {
    event_name: spec.name,
    event_time: eventTime(order),
    event_id: eventId(order, spec.name),
    action_source: 'website',
    user_data: await hashUserData(order),
  };
  if (cfg.sourceUrl) ev.event_source_url = cfg.sourceUrl;
  if (spec.withValue) {
    ev.custom_data = {
      currency: 'MAD',
      value: Number(order.price) || 0,
      content_name: order.product?.name || '',
      order_id: String(order.id),
    };
  }
  return ev;
}

/** Envoie des évènements déjà construits. Renvoie { ok, error }. */
export async function sendEvents(events, cfg, authToken) {
  if (!events.length) return { ok: true, sent: 0 };
  const res = await fetch('/api/meta-capi', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({
      pixelId: cfg.pixelId,
      token: cfg.token,
      testCode: cfg.testCode || undefined,
      events,
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: j.error || `Erreur ${res.status}` };
  return { ok: true, sent: j.received ?? events.length };
}
