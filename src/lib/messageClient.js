/* « Coller depuis WhatsApp » : un message de cliente collé tel quel
 * (darija en lettres arabes ou latines, français, plusieurs lignes ou une
 * seule) → nom, téléphone, ville, adresse, taille, couleur. Tout est
 * facultatif : on ne remplit que ce qu'on reconnaît avec assez de sûreté,
 * et le formulaire reste modifiable avant d'enregistrer. */

const CHIFFRES_ARABES = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' };

export const chiffresLatins = (s) => String(s || '').replace(/[٠-٩۰-۹]/g, c => CHIFFRES_ARABES[c]);

/** Minuscules, sans accents, lettres arabes unifiées (أإآ→ا, ة→ه, ى→ي). */
export function normaliser(s) {
  return chiffresLatins(s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[ً-ْـ]/g, '') // voyelles et tatweel arabes
    .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/[’'`´-]/g, ' ')
    // Article arabe « ال » retiré en tête de mot : « الكحل » = « كحل »,
    // « الدار البيضاء » = « دار بيضاء » (appliqué pareil aux alias).
    .replace(/(^|\s)ال(?=[\u0621-\u064A]{2,})/gu, '$1')
    .replace(/\s+/g, ' ').trim();
}

/** Premier numéro marocain trouvé, au format 0XXXXXXXXX. */
export function extraireTelephone(texte) {
  const t = chiffresLatins(texte);
  const m = t.match(/(?:\+|00)?\s*212[\s.-]*0?[\s.-]*([5-7](?:[\s.-]*\d){8})|(?<!\d)0[\s.-]*([5-7](?:[\s.-]*\d){8})(?!\d)/);
  if (!m) return null;
  return '0' + (m[1] || m[2]).replace(/\D/g, '');
}

/* Villes écrites en arabe ou en darija → nom usuel en français. La liste
   des villes des livreurs (Ozon…) reste la référence pour l'orthographe
   finale (voir trouverVille). */
const ALIAS_VILLES = {
  'الدار البيضاء': 'Casablanca', 'البيضاء': 'Casablanca', 'كازا': 'Casablanca', 'casa': 'Casablanca', 'dar bida': 'Casablanca', 'darbida': 'Casablanca',
  'الرباط': 'Rabat', 'rbat': 'Rabat', 'مراكش': 'Marrakech', 'marrakesh': 'Marrakech', 'مراكيش': 'Marrakech',
  'طنجه': 'Tanger', 'tanja': 'Tanger', 'tangier': 'Tanger', 'فاس': 'Fes', 'مكناس': 'Meknes', 'اكادير': 'Agadir',
  'وجده': 'Oujda', 'القنيطره': 'Kenitra', 'qnitra': 'Kenitra', 'تطوان': 'Tetouan', 'سلا': 'Sale', 'المحمديه': 'Mohammedia',
  'اسفي': 'Safi', 'سفي': 'Safi', 'الجديده': 'El Jadida', 'jdida': 'El Jadida', 'بني ملال': 'Beni Mellal', 'خريبكه': 'Khouribga',
  'سطات': 'Settat', 'الناظور': 'Nador', 'العيون': 'Laayoune', 'تازه': 'Taza', 'برشيد': 'Berrechid', 'خنيفره': 'Khenifra',
  'الحسيمه': 'Al Hoceima', 'ورزازات': 'Ouarzazate', 'تماره': 'Temara', 'سيدي قاسم': 'Sidi Kacem', 'القصر الكبير': 'Ksar El Kebir',
  'العرائش': 'Larache', 'الصويره': 'Essaouira', 'الرشيديه': 'Errachidia', 'كلميم': 'Guelmim', 'تيزنيت': 'Tiznit',
  'انزكان': 'Inezgane', 'ايت ملول': 'Ait Melloul', 'الفقيه بن صالح': 'Fquih Ben Salah', 'سيدي سليمان': 'Sidi Slimane',
  'وادي زم': 'Oued Zem', 'تاونات': 'Taounate', 'الخميسات': 'Khemisset', 'بركان': 'Berkane', 'تارودانت': 'Taroudant',
  'شفشاون': 'Chefchaouen', 'ازرو': 'Azrou', 'افران': 'Ifrane', 'ابن جرير': 'Ben Guerir', 'بنجرير': 'Ben Guerir',
  'الصخيرات': 'Skhirat', 'بوزنيقه': 'Bouznika', 'سيدي بنور': 'Sidi Bennour', 'الداخله': 'Dakhla', 'تملالت': 'Tamellalt',
};

const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const contientMot = (texteNorm, motNorm) => motNorm.length >= 3
  && new RegExp(`(^|[^\\p{L}])${echapper(motNorm)}($|[^\\p{L}])`, 'u').test(texteNorm);

/** Ville reconnue, dans l'orthographe de `villesConnues` quand elle y est. */
export function trouverVille(texte, villesConnues = []) {
  const n = normaliser(texte);
  const parNorm = new Map(villesConnues.filter(Boolean).map(v => [normaliser(v), v]));
  const versConnue = (nom) => parNorm.get(normaliser(nom)) || nom;
  // La plus longue d'abord : « Ksar El Kebir » avant « Kebir », « Sidi Kacem » avant « Kacem ».
  const candidats = [
    ...[...parNorm.keys()].map(k => ({ cle: k, ville: parNorm.get(k) })),
    ...Object.entries(ALIAS_VILLES).map(([alias, ville]) => ({ cle: normaliser(alias), ville: versConnue(ville) })),
    ...[...new Set(Object.values(ALIAS_VILLES))].map(v => ({ cle: normaliser(v), ville: versConnue(v) })),
  ].sort((a, b) => b.cle.length - a.cle.length);
  const t = candidats.find(c => contientMot(n, c.cle));
  return t ? t.ville : null;
}

/* Tailles : 2XL/3XL/XXL/XL partout ; S/M/L seuls seulement après un mot
   « taille » (sinon le moindre « l » ou « m » isolé serait pris pour une taille). */
export function trouverTaille(texte) {
  const t = chiffresLatins(texte);
  const grande = t.match(/(?<![\p{L}\d])(5xl|4xl|3xl|2xl|xxxl|xxl|xl|xs)(?![\p{L}\d])/iu);
  if (grande) {
    const v = grande[1].toUpperCase();
    return v === 'XXXL' ? '3XL' : v;
  }
  const apresMot = t.match(/(?:taille|size|مقاس|قياس|القياس|المقاس|t)\s*[:=]?\s*(s|m|l)(?![\p{L}\d])/iu);
  if (apresMot) return apresMot[1].toUpperCase();
  const seul = t.match(/(?<![\p{L}\d])(S|M|L)(?![\p{L}\d])/u);
  return seul ? seul[1] : null;
}

/* Couleurs : mot arabe/darija → mot utilisé dans les noms de produits. */
const COULEURS = [
  ['Noir', ['noir', 'black', 'كحل', 'كحله', 'كحلة', 'اسود', 'لكحل', 'k7al', 'k7el', 'khal']],
  ['Marron', ['marron', 'brun', 'مارون', 'ماروني', 'قهوي', 'بني', 'كافي']],
  ['Taupe', ['taupe', 'تاوب', 'توب']],
  ['Beige', ['beige', 'بيج']],
  ['Kaki', ['kaki', 'khaki', 'كاكي']],
  ['Gris', ['gris', 'رمادي', 'رمادية', 'griss']],
  ['Blanc', ['blanc', 'white', 'ابيض', 'بيض', 'بيضا', 'لبيض']],
  ['Rose', ['rose', 'pink', 'وردي', 'روز', 'ورديه']],
  ['Bleu roi', ['bleu roi', 'ازرق ملكي', 'bleu fonce']],
  ['Bleu ciel', ['bleu ciel', 'ازرق فاتح', 'سماوي', 'bleu clair']],
  ['Bleu', ['bleu', 'ازرق', 'زرق', 'blue']],
  ['Vert', ['vert', 'اخضر', 'خضر', 'green']],
  ['Rouge', ['rouge', 'احمر', 'حمر', 'red']],
];

export function trouverCouleur(texte) {
  const n = normaliser(texte);
  for (const [couleur, mots] of COULEURS) {
    if (mots.some(m => contientMot(n, normaliser(m)) || (normaliser(m).length < 3 && false))) return couleur;
  }
  return null;
}

/** Produit du catalogue dont le nom porte la couleur demandée (hijab si le message en parle). */
export function trouverProduit(texte, produits = [], couleur = trouverCouleur(texte)) {
  if (!couleur || !produits.length) return null;
  const n = normaliser(texte);
  const veutHijab = /hijab|حجاب|محجب|lhijab/.test(n);
  const c = normaliser(couleur);
  const avecCouleur = produits.filter(p => normaliser(p.name).includes(c));
  if (!avecCouleur.length) return null;
  const memeType = avecCouleur.filter(p => /hijab/.test(normaliser(p.name)) === veutHijab);
  return (memeType[0] || avecCouleur[0]).name;
}

const PREFIXES_NOM = /(?:^|\s)(?:سميتي|اسمي|الاسم|السميه|السمية|smiti|smiya|ismi|esmi|nom|name|je m appelle|ana)\s*[:=]?\s*/iu;
const MOTS_ADRESSE = /(حي|زنقه|زنقة|درب|رقم|شارع|اقامه|اقامة|عماره|عمارة|دوار|بلوك|تجزئه|تجزئة|hay|derb|zan9a|zanqa|rue|avenue|av\b|bd\b|boulevard|quartier|residence|lot|lotissement|imm|immeuble|appt|douar|bloc|n°|numero)/iu;

/** Nom : après « سميتي / smiti / nom: … », sinon une première ligne courte sans chiffres. */
export function trouverNom(texte) {
  const lignes = String(texte || '').split(/\n+/).map(l => l.trim()).filter(Boolean);
  for (const l of lignes) {
    const m = l.match(PREFIXES_NOM);
    if (m) {
      const reste = l.slice(m.index + m[0].length).split(/[,،.\d]|\s(?:و|من|f|fi|في|w)\s/u)[0].trim();
      const mots = reste.split(/\s+/).filter(Boolean).slice(0, 3);
      if (mots.length) return mots.join(' ');
    }
  }
  const premiere = lignes[0] || '';
  if (lignes.length > 1 && premiere.length <= 30 && !/\d/.test(chiffresLatins(premiere)) && !MOTS_ADRESSE.test(premiere)
    && !/^(salam|slm|bonjour|bonsoir|السلام|سلام|مرحبا|hello|salut)\b/iu.test(normaliser(premiere))) {
    return premiere;
  }
  return null;
}

/** Adresse : la ligne qui ressemble à une adresse (حي، زنقة، rue…), sans le téléphone. */
export function trouverAdresse(texte) {
  const lignes = String(texte || '').split(/\n+/).map(l => l.trim()).filter(Boolean);
  const nettoyer = (l) => chiffresLatins(l)
    .replace(/(?:\+|00)?\s*212[\s.-]*0?[\s.-]*[5-7](?:[\s.-]*\d){8}|(?<!\d)0[\s.-]*[5-7](?:[\s.-]*\d){8}(?!\d)/g, '')
    .replace(PREFIXES_NOM, ' ')
    .replace(/(?:العنوان|adresse|adress|l3onwan|lanwan)\s*[:=]?\s*/iu, '')
    .replace(/\s+/g, ' ').replace(/^[\s,،.:-]+|[\s,،.:-]+$/g, '');
  const l = lignes.find(x => MOTS_ADRESSE.test(x) || /(?:العنوان|adresse)\s*[:=]/iu.test(x));
  if (l) {
    // Ligne avec des virgules (tout le message sur une ligne) : seulement le
    // morceau qui porte l'adresse, pas le nom ni la commande.
    const bout = l.split(/[,،]/).map(x => x.trim()).find(x => MOTS_ADRESSE.test(x) || /(?:العنوان|adresse)\s*[:=]/iu.test(x));
    return nettoyer(bout || l) || null;
  }
  // Une seule ligne : le morceau qui contient un mot d'adresse.
  const morceaux = String(texte || '').split(/[,،\n]/).map(x => x.trim());
  const m = morceaux.find(x => MOTS_ADRESSE.test(x));
  return m ? nettoyer(m) || null : null;
}

/** Tout ce qu'on reconnaît dans le message. */
export function analyserMessageClient(texte, { villes = [], produits = [] } = {}) {
  const couleur = trouverCouleur(texte);
  return {
    nom: trouverNom(texte),
    telephone: extraireTelephone(texte),
    ville: trouverVille(texte, villes),
    adresse: trouverAdresse(texte),
    taille: trouverTaille(texte),
    couleur,
    produit: trouverProduit(texte, produits, couleur),
  };
}
