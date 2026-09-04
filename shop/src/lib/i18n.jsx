import React, { createContext, useContext, useEffect, useState } from 'react';

/* Deux langues, un bouton pour basculer — pas de détection automatique
   (fiable à moitié, et un client qui a mis son téléphone en anglais ne
   parle pas forcément anglais). Le choix du client se retient d'une
   visite à l'autre. */
const CLE = 'victoury_lang';

const DICT = {
  fr: {
    accueil: 'Accueil', voirCollection: 'Voir la collection',
    ajouterPanier: 'Ajouter au panier', choisirTaille: 'Choisissez une taille',
    tailleLabel: 'Choisissez votre taille :', detailsProduit: 'Détails du produit',
    livraisonTitre: 'Livraison', livraisonTexte: 'Livraison partout au Maroc. Paiement à la livraison.',
    produitsSimilaires: 'Produits similaires', nosNouveautes: 'Nos nouveautés',
    nosNouveautesTexte: 'Les dernières pièces reçues en boutique, à découvrir en premier.',
    tousLesProduits: 'Tous les produits',
    nosCategories: 'Nos catégories', avisClients: 'Avis clients',
    votrePanier: 'Votre panier', panierVide: 'Votre panier est vide',
    sousTotal: 'Sous-total', remise: 'Remise', livraisonGratuite: '✓ Livraison gratuite',
    commander: 'Commander', paiementLivraison: 'Paiement à la livraison',
    coordonnees: "Merci de saisir vos coordonnées de livraison",
    nomComplet: 'Nom complet', telephone: 'Téléphone', ville: 'Ville', adresse: 'Adresse',
    codePromo: 'Code promo', appliquer: 'Appliquer', validerCommande: 'Valider la commande',
    envoiEnCours: 'Envoi…', retourBoutique: 'Retour à la boutique',
    suivezNous: 'Suivez-nous', contact: 'Contact', collections: 'Collections',
    mentionsLegales: 'Mentions légales', rechercher: 'Rechercher',
    toutesTailles: 'Toutes les tailles', aucunProduit: "Aucun article disponible dans cette taille",
    epuise: 'Momentanément épuisé', couleur: 'Couleur', numeroCommande: 'N° commande',
    photoAVenir: 'Photo à venir', produitIntrouvable: "Ce produit n'existe plus.",
    plusQue: 'Plus que', pourLivraisonGratuite: 'pour la livraison gratuite',
    quantiteMinus: 'Diminuer', quantitePlus: 'Augmenter', retirer: 'Retirer',
    profitezDuTarif: "Profitez-en pour ajouter :", voirProduit: 'Voir',
  },
  ar: {
    accueil: 'الرئيسية', voirCollection: 'مشاهدة المجموعة',
    ajouterPanier: 'أضف إلى السلة', choisirTaille: 'اختر مقاسًا',
    tailleLabel: 'اختر القياس المناسب لك:', detailsProduit: 'تفاصيل المنتج',
    livraisonTitre: 'التوصيل', livraisonTexte: 'التوصيل إلى جميع أنحاء المغرب. الدفع عند الاستلام.',
    produitsSimilaires: 'منتجات مشابهة', nosNouveautes: 'أحدث المنتجات',
    nosNouveautesTexte: 'آخر القطع الواصلة إلى المتجر، اكتشفوها أولاً.',
    tousLesProduits: 'جميع المنتجات',
    nosCategories: 'فئاتنا', avisClients: 'آراء العملاء',
    votrePanier: 'سلتك', panierVide: 'سلتك فارغة',
    sousTotal: 'المجموع الفرعي', remise: 'خصم', livraisonGratuite: '✓ توصيل مجاني',
    commander: 'اطلب الآن', paiementLivraison: 'الدفع عند الاستلام',
    coordonnees: 'يرجى إدخال معلومات التوصيل الخاصة بك',
    nomComplet: 'الاسم الكامل', telephone: 'الهاتف', ville: 'المدينة', adresse: 'العنوان',
    codePromo: 'رمز الخصم', appliquer: 'تطبيق', validerCommande: 'تأكيد الطلب',
    envoiEnCours: 'جارٍ الإرسال…', retourBoutique: 'العودة إلى المتجر',
    suivezNous: 'تابعونا', contact: 'تواصل معنا', collections: 'المجموعات',
    mentionsLegales: 'الشروط والأحكام', rechercher: 'بحث',
    toutesTailles: 'جميع المقاسات', aucunProduit: 'لا يوجد منتج متوفر بهذا المقاس',
    epuise: 'نفدت الكمية مؤقتًا', couleur: 'اللون', numeroCommande: 'رقم الطلب',
    photoAVenir: 'الصورة قريبًا', produitIntrouvable: 'هذا المنتج لم يعد متوفرًا.',
    plusQue: 'باقي', pourLivraisonGratuite: 'للحصول على توصيل مجاني',
    quantiteMinus: 'إنقاص', quantitePlus: 'زيادة', retirer: 'حذف',
    profitezDuTarif: 'اغتنم الفرصة وأضف:', voirProduit: 'عرض',
  },
};

// Ordinaux arabes courants (paliers de remise : 2e, 3e article… au-delà de
// 10 c'est un palier peu réaliste, le repli reste correct même s'il est moins idiomatique).
const ORDINAUX_AR = { 2: 'الثاني', 3: 'الثالث', 4: 'الرابع', 5: 'الخامس', 6: 'السادس', 7: 'السابع', 8: 'الثامن', 9: 'التاسع', 10: 'العاشر' };
const ordinalFr = (n) => `${n}ème`;
const ordinalAr = (n) => ORDINAUX_AR[n] || `رقم ${n}`;

// Isole un fragment latin (nombre + %) dans le sens LTR au milieu d'une
// phrase arabe RTL, avec la vraie balise HTML prévue pour ça (<bdi>) — les
// marques Unicode invisibles (U+2066/U+2069) se sont révélées visibles comme
// petits traits sur certaines polices Android : <bdi> isole sans jamais
// s'afficher lui-même. En gras au passage, comme demandé, pour que le chiffre
// ressorte dans la phrase.
const Ltr = ({ children }) => <bdi className="font-bold" dir="ltr">{children}</bdi>;

/** "−20% dès le 2ème article" / "−20% ابتداءً من المنتج الثاني" — l'ordinal
    change de forme d'une langue à l'autre, pas seulement de mot. */
const remisePalier = (lang, pourcent, rang) => lang === 'ar'
  ? <><Ltr>−{pourcent}%</Ltr> ابتداءً من المنتج {ordinalAr(rang)}</>
  : <>−<Ltr>{pourcent}%</Ltr> dès le {ordinalFr(rang)} article</>;

/** "Encore 1 article et −20% sur toute la commande" / version arabe — le
    coup de pouce affiché dans le panier quand un palier de remise est à
    portée. */
const encoreEtRemise = (lang, manque, pourcent) => lang === 'ar'
  ? <>أضف <Ltr>{manque}</Ltr> {manque > 1 ? 'قطع أخرى' : 'قطعة أخرى'} واستفد من خصم <Ltr>{pourcent}%</Ltr></>
  : <>Encore <Ltr>{manque}</Ltr> article{manque > 1 ? 's' : ''} et −<Ltr>{pourcent}%</Ltr> sur toute la commande</>;

/** Ajouté au message précédent SEULEMENT si la livraison est vraiment déjà
    gratuite (le composant sait, lui, si le seuil est atteint) — sans quoi
    "livraison gratuite" serait une fausse promesse. */
const etLivraisonGratuite = (lang) => lang === 'ar' ? ' والتوصيل مجانا 🔥' : ', livraison gratuite 🔥';

const LangContext = createContext({ lang: 'fr', setLang: () => {}, t: (k) => k, remisePalier: () => '', encoreEtRemise: () => '' });

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem(CLE) === 'fr' ? 'fr' : 'ar'; } catch { return 'ar'; }
  });

  useEffect(() => {
    try { localStorage.setItem(CLE, lang); } catch {}
    document.documentElement.lang = lang;
    // Volontairement toujours LTR : la mise en page (grille, icônes, sens du
    // panier) est pensée pour un sens de lecture, la faire basculer en RTL
    // avec l'arabe la casserait — seul le texte change de langue.
  }, [lang]);

  const t = (cle) => DICT[lang]?.[cle] ?? DICT.fr[cle] ?? cle;

  return <LangContext.Provider value={{
    lang, setLang, t,
    remisePalier: (pourcent, rang) => remisePalier(lang, pourcent, rang),
    encoreEtRemise: (manque, pourcent) => encoreEtRemise(lang, manque, pourcent),
    etLivraisonGratuite: () => etLivraisonGratuite(lang),
  }}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
