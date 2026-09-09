/* Valeurs par défaut du catalogue/boutique — extraites de catalog.js pour
 * qu'App.jsx (chargé en entier, jamais en lazy) puisse les lire SANS tirer
 * avec elles tout le client Supabase (~220 Ko) dans le même graphe de
 * modules synchrone. catalog.js les réexporte pour que les nombreux autres
 * fichiers qui les importaient déjà via lui continuent de fonctionner sans
 * changement. */

/* Réglages de la boutique — remises, livraison, contact. Un défaut est
   toujours rendu : une boutique sans réglage doit rester vendable. */
export const REGLAGES_DEFAUT = {
  paliers: [],
  livraison: 0,
  seuilGratuit: null,
  telephone: '',
  // Sauvegarde chaque commande vers une feuille Google Sheets (au-delà de
  // Supabase) dès qu'elle est enregistrée — filet de secours en cas de
  // souci côté base ou côté app principale. URL d'un Google Apps Script
  // déployé en Web App, voir /store/reglages.
  sheetWebhookUrl: '',
  // Son personnalisé pour le carillon "nouvelle commande" (voir
  // src/lib/sonCommande.js) — un extrait audio en base64, ou vide pour
  // garder le carillon synthétisé par défaut.
  sonCommandeUrl: '',
};

// Le Meta Pixel vit dans sa propre clé : ni son activation ni son identifiant
// ne se mélangent aux réglages généraux, qui ont chacun leur propre page
// d'administration.
export const PIXEL_DEFAUT = { enabled: false, pixelId: '', testCode: '' };

/* Microsoft Clarity : enregistrements de session et cartes de chaleur.
 * L'identifiant de projet n'a rien d'un secret — c'est la même valeur que
 * n'importe qui verrait déjà dans le code source de chaque page — et peut
 * donc, contrairement au jeton d'accès de Meta, vivre sans risque dans les
 * réglages publics de la boutique. */
export const CLARITY_DEFAUT = { enabled: false, projectId: '' };

/* L'apparence de la boutique — logo, favicon, bandeau d'annonce — vit elle
   aussi à part : ce sont des réglages visuels, réglés depuis /store/theme,
   pas des règles de vente comme les remises ou la livraison. */
export const THEME_DEFAUT = {
  logoUrl: '', faviconUrl: '',
  // 'gauche' | 'centre' | 'droite' — position du logo (et, avec lui, de la
  // navigation) dans l'en-tête.
  logoPosition: 'gauche',
  // Couleur principale du site — texte, boutons, bordures actives. Une seule
  // valeur plutôt qu'un réglage par élément : c'est la teinte de la marque,
  // pas un détail à régler ailleurs pour chaque bouton séparément.
  couleurTexte: '#111111',
  annonceActive: true,
  annonces: ['Livraison partout au Maroc · Paiement à la livraison'],
  // Rotation séparée pour l'arabe : traduire mot à mot les annonces
  // françaises donnerait un texte plat, alors qu'une vraie annonce se
  // rédige différemment dans chaque langue (voir aussi remisePalier dans
  // i18n.jsx pour la même idée sur les badges de remise).
  annoncesAr: [
    'التوصيل لجميع المدن المغربية. الدفع عند الاستلام',
    'استغلوا الفرصة! تخفيض حصري بنسبة 20% على القطعة الثانية',
  ],
  tailleAnnonce: 11,
  epaisseurAnnonce: 'normal',
  couleurAnnonceFond: '#111111',
  couleurAnnonceTexte: '#ffffff',

  hero: {
    // Vide tant que Supabase n'a pas répondu : le premier rendu (avant que
    // les vraies diapositives réglées dans /store/theme n'arrivent) montrait
    // sinon une photo fournisseur de secours (hero-victoury.jpg, jamais
    // choisie par l'admin) — HeroCarrousel affiche un simple dégradé neutre
    // en attendant, jamais une photo qu'on n'a pas voulue.
    imageDesktop: '', imageMobile: '',
    // Plusieurs diapositives possibles (2-3 photos qui défilent). Une boutique
    // qui n'en a réglé aucune retombe sur la photo unique ci-dessus.
    slides: [],
    titre: 'Bienvenue chez Victoury', sousTitre: 'Le confort au quotidien',
    boutonTexte: 'Voir la collection', boutonLien: '',
  },
  texteSousHero: { texte: '', taille: 14, couleurTexte: '#000000', couleurFond: '#f9f6f0' },

  // Guide des tailles : une seule image (tableau de mesures) valable pour
  // toute la boutique — plus simple à tenir à jour qu'un tableau par
  // produit, et suffisant pour une boutique mono-catégorie de vêtements.
  // Désactivé par défaut : rien à montrer tant que l'admin n'a rien déposé.
  guideTailles: { active: false, image: '' },

  // Section "vedette" : une collection mise en avant à mi-page (grande photo
  // + texte + quelques produits), comme le fait un site de mode pour son
  // lancement du moment — plus marquant qu'une simple carte dans la grille
  // "Nos catégories". Désactivée par défaut : rien à afficher tant qu'aucune
  // collection n'a été choisie dans /store/edit-theme.
  sectionVedette: {
    active: false, image: '', imagePosition: 'gauche',
    titre: '', texte: '', boutonTexte: 'Voir la collection', collectionSlug: '',
    // Une traduction absente retombe sur le texte français (voir
    // SectionVedette.jsx) plutôt que d'afficher un texte vide en arabe.
    titreAr: '', texteAr: '', boutonTexteAr: '',
  },

  // Trois arguments de réassurance sous le Hero — livraison, contact, paiement
  // à la livraison : ce qui rassure le plus un premier achat en ligne au Maroc.
  reassuranceActive: true,
  reassurance: [
    { titre: 'Livraison gratuite sur toutes les commandes', texte: 'Bénéficiez de la livraison gratuite pour toute commande supérieure à 200 dh ; Livraison sous 12 à 24 heures dans toutes les villes marocaines.' },
    { titre: 'Service client 7j/7', texte: "Notre équipe est à votre disposition pour répondre à toutes vos questions et confirmer vos commandes via WhatsApp ou par téléphone." },
    { titre: 'Paiement à la livraison', texte: "Commandez en toute sécurité ! Vous ne payez qu'après avoir reçu, vérifié et testé votre produit entre vos mains." },
  ],

  footer: {
    description: '',
    couleurFond: '#f7f5f2', couleurTexte: '#111111',
    collections: [], reseaux: [], mentions: [
      { label: 'Conditions générales de vente', url: '/conditions-generales-de-vente' },
      { label: 'Politique de livraison', url: '/politique-de-livraison' },
      { label: "Politique d'échange", url: '/politique-dechange' },
      { label: 'Politique de confidentialité', url: '/politique-de-confidentialite' },
    ],
    // Moyens de paiement acceptés, affichés en badges dans le footer.
    paiement: { livraison: true, virement: true },
    // Icônes de contact toujours visibles (même vides) pour que l'admin voie
    // tout de suite lesquelles restent à renseigner.
    contacts: { whatsapp: '', appel: '', instagram: '', tiktok: '', facebook: '' },
  },

  // Filtre par taille sur les pages de collection : pertinent quand une même
  // collection mélange des tailles vêtement (S…XL) et des tailles pointure —
  // sinon superflu, d'où l'option plutôt qu'un affichage forcé.
  collectionFiltreTaille: true,
  // Affichage des tailles sur la fiche produit : « grille » (celui déjà en
  // place) convient à un choix court (S…XL) ; « liste » convient mieux à un
  // choix long comme des pointures.
  produitAffichageTailles: 'grille',
};

/** Stock disponible d'une taille — 0 quand la taille n'existe plus. */
export const stockTaille = (produit, taille) =>
  produit?.sizes?.find(s => s.size === taille)?.stock ?? 0;
