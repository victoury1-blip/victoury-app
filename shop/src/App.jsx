import React, { useCallback, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import AnnonceBar from './components/AnnonceBar';
import Header from './components/Header';
import Footer from './components/Footer';
import TiroirPanier from './components/TiroirPanier';
import Accueil from './pages/Accueil';
import Collection from './pages/Collection';
import Produit from './pages/Produit';
import Commander from './pages/Commander';
import Merci from './pages/Merci';
import PageStatique from './pages/PageStatique';
import AdminAuth from './store/AdminAuth';
import AdminLayout from './store/AdminLayout';
import Dashboard from './store/Dashboard';
import ProduitsListe from './store/ProduitsListe';
import ProduitForm from './store/ProduitForm';
import CollectionsListe from './store/CollectionsListe';
import PagesListe from './store/PagesListe';
import CodesPromo from './store/CodesPromo';
import MetaPixel from './store/MetaPixel';
import EditTheme from './store/EditTheme';
import Reglages from './store/Reglages';
import { chargerCollections, chargerReglages, REGLAGES_DEFAUT, PIXEL_DEFAUT, THEME_DEFAUT } from './lib/catalog';
import { lirePanier, ecrirePanier, ajouter, changerQuantite, retirer, vider } from './lib/panier';
import { nbArticles } from './lib/pricing';
import { chargerPixel, trackPixel } from './lib/pixel';

/* L'habillage de la vitrine — bandeau, en-tête, panier, pied de page — ne
   doit jamais apparaître sur l'administration : elle a sa propre mise en
   page, et un visiteur n'y passe jamais. La route décide seule laquelle
   des deux applications elle sert. */
function Vitrine() {
  const [collections, setCollections] = useState([]);
  const [reglages, setReglages] = useState({ ...REGLAGES_DEFAUT, pixel: PIXEL_DEFAUT, theme: THEME_DEFAUT });
  const [lignes, setLignes] = useState(lirePanier);
  const [panierOuvert, setPanierOuvert] = useState(false);

  useEffect(() => {
    chargerCollections().then(setCollections).catch(() => {});
    chargerReglages().then(setReglages).catch(() => {});
  }, []);

  // Le pixel se charge une fois, dès que son réglage arrive — jamais avant,
  // pour ne jamais l'activer avec un identifiant vide ou périmé.
  useEffect(() => {
    if (reglages.pixel?.enabled && reglages.pixel?.pixelId) chargerPixel(reglages.pixel.pixelId);
  }, [reglages.pixel?.enabled, reglages.pixel?.pixelId]);

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
  }, []);

  const onQuantite = useCallback((cle, qty) => setLignes(prev => { const s = changerQuantite(prev, cle, qty); ecrirePanier(s); return s; }), []);
  const onRetirer  = useCallback((cle) => setLignes(prev => { const s = retirer(prev, cle); ecrirePanier(s); return s; }), []);
  const onVider    = useCallback(() => { vider(); setLignes([]); }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <AnnonceBar theme={reglages.theme} />
      <Header collections={collections} nbArticles={nbArticles(lignes)} logoUrl={reglages.theme?.logoUrl} onOuvrirPanier={() => setPanierOuvert(true)} />

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Accueil collections={collections} reglages={reglages} />} />
          {/* Les adresses reprennent EXACTEMENT celles de l'ancienne boutique :
              une annonce en cours pointe dessus, et la changer l'arrêterait. */}
          <Route path="/product-category/:slug" element={<Collection />} />
          <Route path="/product-category/:slug/" element={<Collection />} />
          <Route path="/product/:slug" element={<Produit onAjouter={onAjouter} />} />
          <Route path="/product/:slug/" element={<Produit onAjouter={onAjouter} />} />
          <Route path="/commander" element={<Commander lignes={lignes} reglages={reglages} onRetirer={onRetirer} onVider={onVider} />} />
          <Route path="/merci/:id" element={<Merci />} />
          <Route path="/:slug/" element={<PageStatique />} />
          <Route path="/:slug" element={<PageStatique />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <Footer telephone={reglages.telephone} />

      <TiroirPanier
        ouvert={panierOuvert} lignes={lignes} paliers={reglages.paliers}
        livraison={reglages.livraison} seuilGratuit={reglages.seuilGratuit}
        onFermer={() => setPanierOuvert(false)} onQuantite={onQuantite} onRetirer={onRetirer}
      />
    </div>
  );
}

function Administration() {
  return (
    <AdminAuth>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="produits" element={<ProduitsListe />} />
          <Route path="produits/:id" element={<ProduitForm />} />
          <Route path="collections" element={<CollectionsListe />} />
          <Route path="pages" element={<PagesListe />} />
          <Route path="codes-promo" element={<CodesPromo />} />
          <Route path="meta-pixel" element={<MetaPixel />} />
          <Route path="theme" element={<EditTheme />} />
          <Route path="reglages" element={<Reglages />} />
        </Route>
      </Routes>
    </AdminAuth>
  );
}

export default function App() {
  const { pathname } = useLocation();
  if (pathname === '/store' || pathname.startsWith('/store/')) {
    return (
      <Routes>
        <Route path="/store/*" element={<Administration />} />
      </Routes>
    );
  }
  return <Vitrine />;
}
