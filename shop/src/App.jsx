import React, { useCallback, useEffect, useState, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import AnnonceBar from './components/AnnonceBar';
import Header from './components/Header';
import Footer from './components/Footer';
import TiroirPanier from './components/TiroirPanier';
import WhatsAppBulle from './components/WhatsAppBulle';
import ExitIntentModal from './components/ExitIntentModal';
import ErrorBoundary from './components/ErrorBoundary';
import { REGLAGES_DEFAUT, PIXEL_DEFAUT, THEME_DEFAUT, CLARITY_DEFAUT, TIKTOK_DEFAUT, GA4_DEFAUT } from './lib/catalogDefaults';

/* Un visiteur qui atterrit sur l'accueil (le cas des clics publicitaires)
   n'a jamais besoin du code de la caisse, des fiches produit ou — surtout —
   des 15 pages de l'administration : tout ça partait pourtant dans le même
   fichier JS que la page d'accueil doit télécharger et parser avant même de
   s'afficher. Chargées à la demande, elles ne pèsent plus sur ce premier
   chargement.
   Accueil elle-même est désormais du lot : elle importe catalog.js, qui
   importe le client Supabase (~220 Ko) — un import statique ici forçait ce
   client entier à être téléchargé, parsé ET EXÉCUTÉ avant le tout premier
   rendu React, même pour un visiteur qui n'ouvre jamais /store. Les
   constantes par défaut ci-dessus viennent de catalogDefaults.js, qui lui
   n'importe PAS Supabase, pour que ce fichier-ci reste léger. */
const Accueil = lazy(() => import('./pages/Accueil'));
const Collection = lazy(() => import('./pages/Collection'));
const Produit = lazy(() => import('./pages/Produit'));
const Favoris = lazy(() => import('./pages/Favoris'));
const Commander = lazy(() => import('./pages/Commander'));
const Merci = lazy(() => import('./pages/Merci'));
const PageStatique = lazy(() => import('./pages/PageStatique'));
const AdminAuth = lazy(() => import('./store/AdminAuth'));
const AdminLayout = lazy(() => import('./store/AdminLayout'));
const Dashboard = lazy(() => import('./store/Dashboard'));
const ProduitsListe = lazy(() => import('./store/ProduitsListe'));
const ProduitForm = lazy(() => import('./store/ProduitForm'));
const CollectionsListe = lazy(() => import('./store/CollectionsListe'));
const MediaListe = lazy(() => import('./store/MediaListe'));
const ImportWoo = lazy(() => import('./store/ImportWoo'));
const AvisListe = lazy(() => import('./store/AvisListe'));
const AvisProduitsListe = lazy(() => import('./store/AvisProduitsListe'));
const PagesListe = lazy(() => import('./store/PagesListe'));
const CodesPromo = lazy(() => import('./store/CodesPromo'));
const MetaPixel = lazy(() => import('./store/MetaPixel'));
const EditTheme = lazy(() => import('./store/EditTheme'));
const CommandesListe = lazy(() => import('./store/CommandesListe'));
const PaniersAbandonnesListe = lazy(() => import('./store/PaniersAbandonnesListe'));
const MicrosoftClarity = lazy(() => import('./store/MicrosoftClarity'));
const TikTokPixel = lazy(() => import('./store/TikTokPixel'));
const GoogleAnalytics = lazy(() => import('./store/GoogleAnalytics'));
const RemisesListe = lazy(() => import('./store/RemisesListe'));
const Reglages = lazy(() => import('./store/Reglages'));
import { lirePanier, ecrirePanier, ajouter, changerQuantite, retirer, vider } from './lib/panier';
import { nbArticles } from './lib/pricing';
import { chargerPixel, trackPixel, chargerClarity, chargerTikTokPixel, trackTikTok, chargerGA4, trackGA4, envoyerTikTokCAPI, cookieTtpPourTikTok, idEvenement } from './lib/pixel';
import { LangProvider } from './lib/i18n';

/* React Router ne remet PAS le défilement en haut tout seul en changeant de
   page — la fiche produit s'en charge elle-même (window.scrollTo dans son
   propre effet), mais les autres pages arrivaient avec le défilement du
   trajet précédent : la caisse pouvait s'ouvrir au milieu du formulaire,
   sans le titre ni le premier champ visibles. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

/* L'habillage de la vitrine — bandeau, en-tête, panier, pied de page — ne
   doit jamais apparaître sur l'administration : elle a sa propre mise en
   page, et un visiteur n'y passe jamais. La route décide seule laquelle
   des deux applications elle sert. */
// Les VRAIS réglages (couleur du bandeau, photo du hero…) mettent un
// aller-retour Supabase à arriver — entre-temps, l'état initial ci-dessous
// s'affichait tel quel : bandeau blanc, photo par défaut, pendant une
// seconde à chaque rafraîchissement, avant que le bon réglage n'écrase tout
// d'un coup. Une copie du dernier chargement réussi, gardée en localStorage
// (même schéma que les autres réglages du site), permet au tout premier
// rendu de déjà porter les bonnes couleurs — Supabase ne fait plus ensuite
// que confirmer ou corriger, sans "flash" visible.
const CACHE_REGLAGES = 'shop_reglages_cache';
function reglagesInitiaux() {
  const defaut = { ...REGLAGES_DEFAUT, pixel: PIXEL_DEFAUT, theme: THEME_DEFAUT, clarity: CLARITY_DEFAUT, tiktok: TIKTOK_DEFAUT, ga4: GA4_DEFAUT };
  try {
    const brut = localStorage.getItem(CACHE_REGLAGES);
    return brut ? { ...defaut, ...JSON.parse(brut) } : defaut;
  } catch { return defaut; }
}

// Même principe pour les collections : sans cache, la barre de catégories de
// l'en-tête (sticky, tout en haut) était absente au premier rendu puis
// apparaissait d'un coup une fois Supabase répondu — poussant TOUT le reste
// de la page (hero compris) vers le bas d'autant, la plus grande contribution
// possible à un décalage de mise en page (CLS) puisqu'elle touche l'élément
// le plus haut de la page.
const CACHE_COLLECTIONS = 'shop_collections_cache';
function collectionsInitiales() {
  try {
    const brut = localStorage.getItem(CACHE_COLLECTIONS);
    return brut ? JSON.parse(brut) : [];
  } catch { return []; }
}

function Vitrine() {
  const { pathname } = useLocation();
  const [collections, setCollections] = useState(collectionsInitiales);
  const [reglages, setReglages] = useState(reglagesInitiaux);
  const [lignes, setLignes] = useState(lirePanier);
  const [panierOuvert, setPanierOuvert] = useState(false);
  // "Acheter maintenant" (Produit.jsx) : le même Commander, dans une fenêtre
  // par-dessus la fiche produit plutôt qu'une navigation vers /commander —
  // le client reste sur la même page, rien à recharger, le clic depuis une
  // pub ne perd jamais son contexte. La validation d'une commande, elle,
  // navigue quand même vers /merci/:id (dans Commander.jsx) : cette
  // confirmation-là mérite sa propre page.
  const [achatRapideOuvert, setAchatRapideOuvert] = useState(false);
  // Commander navigue vers /merci/:id tout seul une fois la commande validée
  // (voir Commander.jsx) — sans ça, la fenêtre resterait ouverte par-dessus
  // la page de confirmation au lieu de la laisser s'afficher.
  useEffect(() => { if (pathname.startsWith('/merci/')) setAchatRapideOuvert(false); }, [pathname]);
  const [exitIntentOuvert, setExitIntentOuvert] = useState(false);
  // Sur une première visite (jamais de cache local — exactement le cas d'un
  // clic sur une pub), collections ET reglages démarrent vides : les
  // colonnes "Collections"/"Mentions légales" du pied de page n'existaient
  // tout simplement pas au premier rendu, puis apparaissaient d'un coup une
  // fois Supabase répondu — le plus gros décalage de mise en page (CLS)
  // relevé sur les pages catégorie, où le pied de page est proche du haut.
  // Tant que ce n'est pas prêt, le Footer garde une hauteur de secours au
  // lieu d'ajouter/retirer ces colonnes.
  // Déjà "prêt" si un cache existait dès ce premier rendu (visite pas
  // vraiment "première") — seule une vraie première visite, sans rien en
  // localStorage, doit passer par l'état de secours du Footer.
  const [pretFooter, setPretFooter] = useState(() => {
    try { return !!localStorage.getItem(CACHE_COLLECTIONS) && !!localStorage.getItem(CACHE_REGLAGES); } catch { return false; }
  });

  useEffect(() => {
    // Import dynamique : charge catalog.js (et le client Supabase qu'il tire
    // avec lui) dans son propre chunk, téléchargé et exécuté APRÈS ce
    // premier rendu plutôt que bloquant avant lui — un import statique en
    // haut de ce fichier aurait eu le même effet qu'importer Accueil
    // statiquement, l'un des deux suffisant à retarder le tout premier rendu.
    import('./lib/catalog').then(({ chargerCollections, chargerReglages }) => {
      const c1 = chargerCollections().then(c => {
        setCollections(c);
        try { localStorage.setItem(CACHE_COLLECTIONS, JSON.stringify(c)); } catch {}
      }).catch(() => {});
      const c2 = chargerReglages().then(r => {
        setReglages(r);
        try { localStorage.setItem(CACHE_REGLAGES, JSON.stringify(r)); } catch {}
      }).catch(() => {});
      Promise.all([c1, c2]).then(() => setPretFooter(true));
    });
  }, []);

  // Popup "avant de partir" — n'intercepte QUE le bouton/geste retour du
  // téléphone ou du navigateur (le "X" propre au navigateur intégré
  // Instagram/TikTok appartient à leur application, aucun site ne peut
  // l'intercepter). Une entrée d'historique "sentinelle" est ajoutée une
  // seule fois par visite (après un court délai, pour ne jamais capter le
  // tout premier retour d'une navigation normale entre deux pages) : le
  // "retour" suivant la consomme sans changer de page, ce qui donne
  // l'occasion d'afficher le popup au lieu de quitter directement — une
  // seule fois par visite (sessionStorage), pour ne jamais devenir un piège
  // qui empêche vraiment de repartir.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const CLE = 'victoury_exit_intent_vu';
    let armee = false;
    try { if (sessionStorage.getItem(CLE)) return; } catch { return; }
    const delai = setTimeout(() => {
      window.history.pushState({ sentinelleSortie: true }, '', window.location.href);
      armee = true;
    }, 4000);
    const surRetour = () => {
      if (!armee) return;
      try {
        if (sessionStorage.getItem(CLE)) return;
        sessionStorage.setItem(CLE, '1');
      } catch { /* navigation privée : tant pis, une seule tentative suffit */ }
      window.history.pushState({ sentinelleSortie: true }, '', window.location.href);
      setExitIntentOuvert(true);
    };
    window.addEventListener('popstate', surRetour);
    return () => { clearTimeout(delai); window.removeEventListener('popstate', surRetour); };
  }, []);

  // Le preconnect vers Supabase est maintenant dans index.html (voir
  // %VITE_SUPABASE_URL%) : la connexion s'ouvre avant même le téléchargement
  // du bundle JS, au lieu d'attendre ce useEffect qui n'arrivait qu'après —
  // trop tard pour gagner l'aller-retour DNS+TLS visé.

  // Le pixel se charge une fois, dès que son réglage arrive — jamais avant,
  // pour ne jamais l'activer avec un identifiant vide ou périmé.
  //
  // Les quatre scripts tiers (Meta, Clarity, TikTok, GA4) sont différés d'un
  // cran : PageSpeed a montré que gtag.js SEUL pèse 167 Kio, et qu'ajouté aux
  // trois autres, ils se mettent tous à télécharger EN MÊME TEMPS que
  // l'image du produit — sur le réseau lent d'un navigateur intégré
  // (Instagram/TikTok, exactement le cas d'un clic sur une pub), ils lui
  // volaient de la bande passante et retardaient de plusieurs secondes le
  // Largest Contentful Paint, la mesure qui compte le plus pour la première
  // impression. `requestIdleCallback` les repousse après que le navigateur
  // ait fini le travail plus urgent (afficher la page).
  //
  // `requestIdleCallback` s'est révélé pas fiable pour ça : le navigateur ne
  // le déclenche que quand il se croit "inactif", et avec une extension de
  // diagnostic ouverte (Meta/TikTok Pixel Helper) ou simplement un onglet
  // resté actif à faire autre chose, il pouvait ne jamais se déclencher dans
  // un délai raisonnable — le pixel restait alors introuvable même après
  // avoir attendu, ce qui perdait pour de bon l'évènement InitiateCheckout
  // (déclenché dès l'arrivée sur /commander, AVANT que le pixel ait fini de
  // charger). L'évènement "load" de la fenêtre, lui, se déclenche TOUJOURS,
  // une seule fois, dès que la page a fini de charger ses ressources — aussi
  // tard que voulu pour ne jamais concurrencer le LCP, mais garanti.
  const differe = (fn) => {
    if (typeof window === 'undefined') return;
    if (document.readyState === 'complete') fn();
    else window.addEventListener('load', fn, { once: true });
  };

  useEffect(() => {
    if (reglages.pixel?.enabled && reglages.pixel?.pixelId) differe(() => chargerPixel(reglages.pixel.pixelId));
  }, [reglages.pixel?.enabled, reglages.pixel?.pixelId]);

  useEffect(() => {
    if (reglages.clarity?.enabled && reglages.clarity?.projectId) differe(() => chargerClarity(reglages.clarity.projectId));
  }, [reglages.clarity?.enabled, reglages.clarity?.projectId]);

  useEffect(() => {
    if (reglages.tiktok?.enabled && reglages.tiktok?.pixelId) differe(() => chargerTikTokPixel(reglages.tiktok.pixelId));
  }, [reglages.tiktok?.enabled, reglages.tiktok?.pixelId]);

  useEffect(() => {
    if (reglages.ga4?.enabled && reglages.ga4?.measurementId) differe(() => chargerGA4(reglages.ga4.measurementId));
  }, [reglages.ga4?.enabled, reglages.ga4?.measurementId]);

  // Site en une seule page (SPA) : gtag ne voit jamais de rechargement, donc
  // jamais de "page_view" tout seul au-delà du tout premier écran — un
  // évènement à chaque changement de route pour que Google Analytics compte
  // la navigation interne comme de vraies pages vues (Accueil → Collection →
  // Produit…), pas une seule visite figée.
  useEffect(() => {
    trackGA4('page_view', { page_path: pathname, page_location: window.location.href });
  }, [pathname]);

  // La couleur principale (texte, boutons, bordures actives) est une variable
  // CSS : la changer ici touche tout le site d'un coup, sans recompiler.
  useEffect(() => {
    const c = reglages.theme?.couleurTexte;
    if (c) document.documentElement.style.setProperty('--ink', c);
  }, [reglages.theme?.couleurTexte]);

  // Le favicon déposé dans l'administration remplace celui de la première
  // installation : sans cette mise à jour, l'onglet du navigateur garderait
  // pour toujours l'icône par défaut, quoi qu'on dépose dans /store/theme.
  useEffect(() => {
    const url = reglages.theme?.faviconUrl;
    if (!url) return;
    const lien = document.querySelector("link[rel='icon']") || document.createElement('link');
    lien.rel = 'icon';
    lien.href = url;
    document.head.appendChild(lien);
  }, [reglages.theme?.faviconUrl]);

  /* Le panier est partagé entre les onglets ouverts : commander depuis l'un
     après avoir ajouté depuis l'autre doit donner le même panier. */
  useEffect(() => {
    const relire = () => setLignes(lirePanier());
    window.addEventListener('storage', relire);
    window.addEventListener('panier:maj', relire);
    return () => {
      window.removeEventListener('storage', relire);
      window.removeEventListener('panier:maj', relire);
    };
  }, []);

  const onAjouter = useCallback((ligne) => {
    setLignes(prev => { const s = ajouter(prev, ligne); ecrirePanier(s); return s; });
    setPanierOuvert(true);
    trackPixel('AddToCart', {
      content_name: ligne.name, content_ids: [ligne.slug], content_type: 'product',
      value: ligne.price, currency: 'MAD',
    });
    trackTikTok('AddToCart', {
      contents: [{ content_id: ligne.slug, content_type: 'product', content_name: ligne.name, price: ligne.price, quantity: 1 }],
      value: ligne.price, currency: 'MAD',
    });
    // Doublon serveur, même principe qu'InitiateCheckout/CompletePayment
    // (voir Commander.jsx) : sans lui, un ad-blocker ou un pixel navigateur
    // pas encore chargé au moment du clic laissait cet évènement invisible
    // à TikTok — c'est justement ce que le Gestionnaire de publicités
    // signalait comme "Add to cart : aucune activité récente".
    if (reglages?.tiktok?.enabled && reglages?.tiktok?.pixelId) {
      envoyerTikTokCAPI(reglages.tiktok.pixelId, [{
        event: 'AddToCart', event_time: Math.floor(Date.now() / 1000), event_id: idEvenement('addtocart'),
        user: cookieTtpPourTikTok(),
        page: { url: window.location.href },
        properties: {
          contents: [{ content_id: ligne.slug, content_type: 'product', content_name: ligne.name, price: ligne.price, quantity: 1 }],
          value: ligne.price, currency: 'MAD',
        },
      }], reglages.tiktok.testCode).catch(() => {});
    }
    trackGA4('add_to_cart', {
      currency: 'MAD', value: ligne.price,
      items: [{ item_id: ligne.slug, item_name: ligne.name, price: ligne.price, quantity: 1 }],
    });
  }, [reglages.tiktok]);

  const onQuantite = useCallback((cle, qty) => setLignes(prev => { const s = changerQuantite(prev, cle, qty); ecrirePanier(s); return s; }), []);
  const onRetirer  = useCallback((cle) => setLignes(prev => { const s = retirer(prev, cle); ecrirePanier(s); return s; }), []);
  const onVider    = useCallback(() => { vider(); setLignes([]); }, []);
  // Une fonction fléchée recréée à chaque rendu de Vitrine (le panier change
  // à chaque ajout) invalidait la référence passée à Header — React.memo sur
  // Header ne servirait alors à rien, une nouvelle prop "différente" à
  // chaque fois annulant la mémoïsation.
  const ouvrirPanier = useCallback(() => setPanierOuvert(true), []);
  const fermerPanier = useCallback(() => setPanierOuvert(false), []);

  return (
    <LangProvider>
    <div className="min-h-screen flex flex-col">
      <ScrollToTop />
      <AnnonceBar theme={reglages.theme} />
      <Header collections={collections} nbArticles={nbArticles(lignes)} logoUrl={reglages.theme?.logoUrl}
        logoPosition={reglages.theme?.logoPosition} logoHauteur={reglages.theme?.logoHauteur} onOuvrirPanier={ouvrirPanier} />

      <main className="flex-1">
        {/* Repli vide (pas de spinner) : ces pages sont déjà découpées en
            chunks séparés, et le temps de téléchargement d'un chunk une fois
            en cache est trop court pour justifier un état de chargement
            visible — seul le tout premier clic vers l'une d'elles l'attend
            une fraction de seconde. */}
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Accueil collections={collections} reglages={reglages} pret={pretFooter} />} />
            {/* Les adresses reprennent EXACTEMENT celles de l'ancienne boutique :
                une annonce en cours pointe dessus, et la changer l'arrêterait. */}
            <Route path="/product-category/:slug" element={<Collection theme={reglages.theme} remises={reglages.remises} />} />
            <Route path="/product-category/:slug/" element={<Collection theme={reglages.theme} remises={reglages.remises} />} />
            <Route path="/product/:slug" element={<Produit onAjouter={onAjouter} theme={reglages.theme} remises={reglages.remises} tiktok={reglages.tiktok} onAchatRapide={() => setAchatRapideOuvert(true)} />} />
            <Route path="/product/:slug/" element={<Produit onAjouter={onAjouter} theme={reglages.theme} remises={reglages.remises} tiktok={reglages.tiktok} onAchatRapide={() => setAchatRapideOuvert(true)} />} />
            <Route path="/favoris" element={<Favoris remises={reglages.remises} />} />
            <Route path="/commander" element={<Commander lignes={lignes} reglages={reglages} onQuantite={onQuantite} onRetirer={onRetirer} onVider={onVider} />} />
            <Route path="/merci/:id" element={<Merci />} />
            <Route path="/:slug/" element={<PageStatique />} />
            <Route path="/:slug" element={<PageStatique />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

      <Footer telephone={reglages.telephone} theme={reglages.theme} collections={collections} pret={pretFooter} />

      <TiroirPanier
        ouvert={panierOuvert} lignes={lignes} paliers={reglages.paliers} remises={reglages.remises}
        livraison={reglages.livraison} seuilGratuit={reglages.seuilGratuit}
        onFermer={fermerPanier} onQuantite={onQuantite} onRetirer={onRetirer}
      />

      {achatRapideOuvert && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setAchatRapideOuvert(false)}>
          <div className="absolute inset-x-0 bottom-0 sm:inset-0 sm:m-auto sm:max-w-2xl sm:h-fit sm:max-h-[90vh]
                          bg-white rounded-t-2xl sm:rounded-2xl overflow-y-auto max-h-[92vh]"
            onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => setAchatRapideOuvert(false)} aria-label="Fermer"
              className="sticky top-3 float-left ms-3 z-10 w-9 h-9 rounded-full bg-white shadow border border-gray-100 grid place-items-center text-ink">
              <X size={18} />
            </button>
            <Suspense fallback={<div className="p-10 text-center text-sm text-gray-400">…</div>}>
              <Commander lignes={lignes} reglages={reglages} onQuantite={onQuantite} onRetirer={onRetirer} onVider={onVider} />
            </Suspense>
          </div>
        </div>
      )}
      <WhatsAppBulle numero={reglages.theme?.footer?.contacts?.whatsapp} />
      <ExitIntentModal ouvert={exitIntentOuvert} onFermer={() => setExitIntentOuvert(false)}
        numero={reglages.theme?.footer?.contacts?.whatsapp} />
    </div>
    </LangProvider>
  );
}

function Administration() {
  return (
    <Suspense fallback={null}>
      <AdminAuth>
        <Routes>
          <Route element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="produits" element={<ProduitsListe />} />
            <Route path="produits/:id" element={<ProduitForm />} />
            <Route path="collections" element={<CollectionsListe />} />
            <Route path="media" element={<MediaListe />} />
            <Route path="import-woo" element={<ImportWoo />} />
            <Route path="pages" element={<PagesListe />} />
            <Route path="avis" element={<AvisListe />} />
            <Route path="avis-produits" element={<AvisProduitsListe />} />
            <Route path="codes-promo" element={<CodesPromo />} />
            <Route path="meta-pixel" element={<MetaPixel />} />
            <Route path="theme" element={<EditTheme />} />
            <Route path="remises" element={<RemisesListe />} />
            <Route path="commandes" element={<CommandesListe />} />
            <Route path="paniers-abandonnes" element={<PaniersAbandonnesListe />} />
            <Route path="microsoft-clarity" element={<MicrosoftClarity />} />
            <Route path="tiktok-pixel" element={<TikTokPixel />} />
            <Route path="google-analytics" element={<GoogleAnalytics />} />
            <Route path="reglages" element={<Reglages />} />
          </Route>
        </Routes>
      </AdminAuth>
    </Suspense>
  );
}

export default function App() {
  const { pathname } = useLocation();
  if (pathname === '/store' || pathname.startsWith('/store/')) {
    return (
      <ErrorBoundary>
        <Routes>
          <Route path="/store/*" element={<Administration />} />
        </Routes>
      </ErrorBoundary>
    );
  }
  return (
    <ErrorBoundary>
      <Vitrine />
    </ErrorBoundary>
  );
}
