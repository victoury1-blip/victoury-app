/* Envoi d'une commande.
 *
 * Elle s'écrit dans la table `orders` de l'application : dès la validation, la
 * vente apparaît dans « À Confirmer », avec son client, ses articles et son
 * prix. Rien à synchroniser, rien qui puisse rester en route — c'est ce qui
 * tombait en panne quand une boutique tierce servait d'intermédiaire.
 */

/* Préfixe réservé aux commandes du site. Il les distingue de VICT (saisies à
   la main) et de WC (ancienne boutique), et les règles de la base n'acceptent
   d'un visiteur que des identifiants de cette forme. */
const PREFIXE = 'VS-';

/** Identifiant lisible, date et heure de la commande en clair — VS-030926-093712
    (JJMMAA-HHMMSS) plutôt qu'une suite de chiffres qui ne dit rien : on lit
    directement quand la commande est passée, sans ouvrir la fiche. Toujours
    sous le préfixe VS- : c'est le seul que la base accepte d'un visiteur
    (voir schema.sql). Cinq chiffres aléatoires en bout de code évitent une
    collision entre deux commandes validées à la même seconde — invisibles
    à l'œil, ils ne gênent pas la lecture. */
export function nouvelId(now = new Date(), alea = Math.random) {
  const p = (n, l = 2) => String(n).padStart(l, '0');
  const date = `${p(now.getDate())}${p(now.getMonth() + 1)}${p(now.getFullYear() % 100)}`;
  const heure = `${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  const r = p(Math.floor(alea() * 1e5), 5);
  return `${PREFIXE}${date}-${heure}${r}`;
}

/* Horodatage au format de l'application : « JJ/MM/AAAA HH:MM:SS ». Un format
   différent se lirait mal partout ailleurs — factures, historiques, exports. */
export function horodatage(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/* Numéro marocain ramené à sa forme locale : le client l'écrit comme il veut,
   le livreur a besoin d'une seule forme. */
export function normaliserTelephone(tel) {
  let s = String(tel || '').replace(/[\s\-.()+]/g, '').replace(/^(00212|212)/, '0');
  if (/^[5-7]\d{8}$/.test(s)) s = '0' + s;
  return s;
}

export const telephoneValide = (tel) => /^0[5-7]\d{8}$/.test(normaliserTelephone(tel));

/* wa.me exige le format international SANS le 0 initial (2126XXXXXXXX) — un
   numéro local (06XXXXXXXX) ou mal saisi donne un lien mort ("numéro non
   valide"). Vide si le numéro n'est de toute façon pas un mobile marocain
   correct, plutôt que d'envoyer wa.me vers un lien cassé. */
export function numeroWhatsApp(tel) {
  const local = normaliserTelephone(tel);
  return /^0[5-7]\d{8}$/.test(local) ? '212' + local.slice(1) : '';
}

/** Ce qui manque pour que la commande puisse partir. */
export function champsManquants(form, lignes) {
  const manque = [];
  if (!String(form.nom || '').trim()) manque.push('nom');
  if (!telephoneValide(form.telephone)) manque.push('telephone');
  if (!String(form.ville || '').trim()) manque.push('ville');
  if (!String(form.adresse || '').trim()) manque.push('adresse');
  if (!lignes?.length) manque.push('panier');
  return manque;
}

/* La commande n'a pas de colonne à elle pour la source de la visite : plutôt
   que modifier le schéma de la table de l'application (partagée avec tout le
   reste du système), l'information se glisse dans `recipient`, un champ déjà
   libre — sans toucher à rien de ce que l'application attend par ailleurs. */

/** La commande telle qu'elle sera écrite en base. */
export function construireCommande(form, lignes, total, now = new Date(), id = nouvelId(), meta = {}) {
  const ts = horodatage(now);
  const produits = lignes.map(l => ({ name: l.name, size: l.size || '', qty: l.qty || 1 }));
  return {
    id,
    recipient: {
      name: String(form.nom || '').trim(),
      phone: normaliserTelephone(form.telephone),
      city: String(form.ville || '').trim(),
      address: String(form.adresse || '').trim(),
      email: String(form.email || '').trim() || undefined,
      delivery: null,
      source: meta.source || undefined,
    },
    // `product` reste la première ligne : toute l'application le lit ainsi.
    product: produits[0] || null,
    products: produits,
    price: total,
    status: 'nouveau',
    note: 'Commande du site',
    date_added: ts,
    date_updated: ts,
    validated: false,
    echange: false,
    report_date: null,
    note_livraison: '',
    tracking_number: null,
    is_deleted: false,
  };
}
