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
    tailleLabel: 'Choisissez votre taille', detailsProduit: 'Détails du produit',
    livraisonTitre: 'Livraison', livraisonTexte: 'Livraison partout au Maroc. Paiement à la livraison.',
    produitsSimilaires: 'Produits similaires', nosNouveautes: 'Nos nouveautés',
    nosCategories: 'Nos catégories', avisClients: 'Avis clients',
    votrePanier: 'Votre panier', panierVide: 'Votre panier est vide',
    sousTotal: 'Sous-total', remise: 'Remise', livraisonGratuite: '✓ Livraison gratuite',
    commander: 'Commander', paiementLivraison: 'Paiement à la livraison',
    coordonnees: "Merci de saisir vos coordonnées de livraison",
    nomComplet: 'Nom complet *', telephone: 'Téléphone *', ville: 'Ville *', adresse: 'Adresse *',
    codePromo: 'Code promo', appliquer: 'Appliquer', validerCommande: 'Valider la commande',
    envoiEnCours: 'Envoi…', retourBoutique: 'Retour à la boutique',
    suivezNous: 'Suivez-nous', contact: 'Contact', collections: 'Collections',
    mentionsLegales: 'Mentions légales', rechercher: 'Rechercher',
    toutesTailles: 'Toutes les tailles', aucunProduit: "Aucun article disponible dans cette taille",
    epuise: 'Momentanément épuisé', couleur: 'Couleur', numeroCommande: 'N° commande',
    photoAVenir: 'Photo à venir', produitIntrouvable: "Ce produit n'existe plus.",
    plusQue: 'Plus que', pourLivraisonGratuite: 'pour la livraison gratuite',
    quantiteMinus: 'Diminuer', quantitePlus: 'Augmenter', retirer: 'Retirer',
  },
  ar: {
    accueil: 'الرئيسية', voirCollection: 'شوف الكوليكسيون',
    ajouterPanier: 'زيد للسلة', choisirTaille: 'اختار قياس',
    tailleLabel: 'اختر القياس', detailsProduit: 'تفاصيل المنتوج',
    livraisonTitre: 'التوصيل', livraisonTexte: 'التوصيل لكل المغرب. الخلاص عند الاستلام.',
    produitsSimilaires: 'منتوجات مشابهة', nosNouveautes: 'جديدنا',
    nosCategories: 'الفئات ديالنا', avisClients: 'آراء الزبناء',
    votrePanier: 'السلة ديالك', panierVide: 'السلة ديالك فارغة',
    sousTotal: 'المجموع', remise: 'تخفيض', livraisonGratuite: '✓ التوصيل مجاني',
    commander: 'اطلب', paiementLivraison: 'الخلاص عند الاستلام',
    coordonnees: 'عمر معلومات التوصيل ديالك',
    nomComplet: 'الاسم الكامل *', telephone: 'الهاتف *', ville: 'المدينة *', adresse: 'العنوان *',
    codePromo: 'كود التخفيض', appliquer: 'طبق', validerCommande: 'أكد الطلب',
    envoiEnCours: 'كيتصيفط…', retourBoutique: 'رجوع للمتجر',
    suivezNous: 'تابعونا', contact: 'تواصل معانا', collections: 'الفئات',
    mentionsLegales: 'الشروط والأحكام', rechercher: 'بحث',
    toutesTailles: 'كلشي القياسات', aucunProduit: 'ماكاينش شي منتوج بهاد القياس',
    epuise: 'نفدات دابا', couleur: 'اللون', numeroCommande: 'رقم الطلب',
    photoAVenir: 'الصورة جاية', produitIntrouvable: 'هاد المنتوج ماعادش كاين.',
    plusQue: 'باقي', pourLivraisonGratuite: 'باش يكون التوصيل مجاني',
    quantiteMinus: 'نقص', quantitePlus: 'زيد', retirer: 'حيد',
  },
};

const LangContext = createContext({ lang: 'fr', setLang: () => {}, t: (k) => k });

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem(CLE) === 'ar' ? 'ar' : 'fr'; } catch { return 'fr'; }
  });

  useEffect(() => {
    try { localStorage.setItem(CLE, lang); } catch {}
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  const t = (cle) => DICT[lang]?.[cle] ?? DICT.fr[cle] ?? cle;

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
