import { mapToAppStatus } from './sheetStatus';

/** Numéro de téléphone marocain (06/07/05 + 8 chiffres, tolère espaces/tirets/+212). */
export function looksLikePhone(v) {
  let s = String(v || '').replace(/[\s\-.()]/g, '');
  s = s.replace(/^\+212/, '0').replace(/^212/, '0');
  return /^0[567]\d{8}$/.test(s);
}

/** Montant : nombre positif plausible, pas un téléphone, pas une date. */
export function looksLikePrice(v) {
  const raw = String(v || '').trim();
  if (!raw || looksLikePhone(raw) || looksLikeDate(raw)) return false;
  if (!/^\d{1,6}([.,]\d{1,3})?$/.test(raw.replace(/\s/g, ''))) return false;
  const n = parseFloat(raw.replace(/\s/g, '').replace(',', '.'));
  return !isNaN(n) && n > 0 && n < 1000000;
}

export function looksLikeDate(v) {
  return /\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{4}|\d{2}:\d{2}/.test(String(v || ''));
}

const CITY_HINTS = ['casa','casablanca','rabat','fes','fès','marrakech','marrakesh','agadir','tanger','tanger','meknes','meknès','oujda','tetouan','tétouan','safi','kenitra','kénitra','jadida','beni mellal','béni','nador','sale','salé','temara','témara','mohammedia','khouribga','settat','berrechid','taza','nador','larache','guelmim','errachidia','ouarzazate','tiznit','essaouira','berkane','khemisset','taourirt','sidi','ain','oulad','douar','hay'];

const SOURCE_HINTS = ['whatsapp','facebook','instagram','tiktok','messenger','shopify','organic','manuel','manual','sheet','google','wa','fb','ig','snapchat','youtube','site web','siteweb','store','boutique'];

/** Canal / source de commande (à ne pas confondre avec le produit). */
export function looksLikeSource(v) {
  const s = String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (!s) return false;
  return SOURCE_HINTS.some(k => s === k || s.includes(k));
}

export function looksLikeCity(v) {
  const s = String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (!s || s.length < 3) return false;
  return CITY_HINTS.some(c => s === c || s.includes(c) || c.includes(s));
}

const HEADER_KW = ['code','id','ref','reference','tracking','nom','name','client','destinataire','prenom','tel','tél','phone','telephone','téléphone','gsm','numero','mobile','ville','city','wilaya','adresse','address','rue','quartier','prix','price','montant','total','cod','statut','status','etat','état','situation','produit','product','article','note','remarque','observation','date'];

/** Le premier rang est-il une ligne d'entêtes (et non des données) ? */
export function hasHeaderRow(cells) {
  if (!cells?.length) return false;
  let hits = 0;
  for (const c of cells) {
    const l = String(c || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
    if (!l) continue;
    if (HEADER_KW.some(k => l === k || l.includes(k))) hits++;
  }
  // au moins 2 cellules ressemblent à des entêtes, et aucune ne ressemble à un téléphone
  return hits >= 2 && !cells.some(c => looksLikePhone(c));
}

/**
 * Détecte le rôle de chaque colonne par le CONTENU (marche même sans entêtes).
 * @param headers liste des clés de colonnes (entêtes réels ou synthétiques col1..colN)
 * @param rows    lignes (objets keyés par header), échantillon suffisant
 * @returns { code,name,phone,city,address,price,product,status,note } → clé de colonne ou undefined
 */
export function detectColumns(headers, rows) {
  const sample = rows.slice(0, 40);
  const frac = (col, pred) => {
    let ok = 0, tot = 0;
    for (const r of sample) {
      const v = r[col];
      if (v === undefined || v === '') continue;
      tot++; if (pred(v)) ok++;
    }
    return tot ? ok / tot : 0;
  };
  const avgLen = (col) => {
    let sum = 0, tot = 0;
    for (const r of sample) { const v = String(r[col] || ''); if (v) { sum += v.length; tot++; } }
    return tot ? sum / tot : 0;
  };
  const wordy = (col) => frac(col, v => /^[\p{L}][\p{L}\s'.-]{1,}$/u.test(String(v).trim()) && /\s|[\p{L}]{3,}/u.test(String(v)));

  const used = new Set();
  const pick = (scorer, min = 0.5) => {
    let best, bestScore = min;
    for (const h of headers) {
      if (used.has(h)) continue;
      const s = scorer(h);
      if (s > bestScore) { bestScore = s; best = h; }
    }
    if (best) used.add(best);
    return best;
  };

  // 1) Champs "forts" détectables par le contenu
  const phone = pick(h => frac(h, looksLikePhone), 0.5);
  // statut : privilégier une colonne de statuts de LIVRAISON (livré/retour/annulé/refusé/échange),
  // sinon toute colonne de statut reconnu (ex. confirmé)
  const DELIV = new Set(['livre', 'refuse', 'annule', 'change', 'retour_recu', 'expedier']);
  const status = pick(h => frac(h, v => DELIV.has(mapToAppStatus(v))), 0.3)
              || pick(h => frac(h, v => mapToAppStatus(v) !== null), 0.5);
  const code = pick(h => frac(h, v => /^[a-z0-9][a-z0-9\-_]{3,}$/i.test(String(v).trim()) && /\d/.test(String(v))), 0.5);
  const price = pick(h => frac(h, looksLikePrice), 0.5);
  const city = pick(h => frac(h, looksLikeCity), 0.35);

  // 2) Colonnes textuelles restantes → nom, adresse, produit dans l'ordre du fichier.
  //    On ignore dates, tailles, colonnes de canal/source (WhatsApp, Facebook…) et vides.
  const textCols = headers.filter(h =>
    !used.has(h) && wordy(h) >= 0.5 && avgLen(h) >= 3 &&
    frac(h, looksLikeDate) < 0.5 && frac(h, looksLikeSource) < 0.5
  );
  const name = textCols[0];
  const address = textCols[1];
  const product = textCols[2];
  [name, address, product].forEach(h => h && used.add(h));
  const note = pick(h => (avgLen(h) >= 8 && frac(h, looksLikeSource) < 0.5 && frac(h, looksLikeDate) < 0.5 ? 0.4 : 0), 0.35);

  return { code, name, phone, city, address, price, product, status, note };
}
