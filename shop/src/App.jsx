import React, { useCallback, useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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
import { chargerCollections, chargerReglages, REGLAGES_DEFAUT } from './lib/catalog';
import { lirePanier, ecrirePanier, ajouter, changerQuantite, retirer, vider } from './lib/panier';
import { nbArticles } from './lib/pricing';

export default function App() {
  const [collections, setCollections] = useState([]);
  const [reglages, setReglages] = useState(REGLAGES_DEFAUT);
  const [lignes, setLignes] = useState(lirePanier);
  const [panierOuvert, setPanierOuvert] = useState(false);

  useEffect(() => {
    chargerCollections().then(setCollections).catch(() => {});
    chargerReglages().then(setReglages).catch(() => {});
  }, []);

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

  const maj = useCallback((suivant) => { setLignes(suivant); ecrirePanier(suivant); }, []);

  const onAjouter = useCallback((ligne) => {
    setLignes(prev => { const s = ajouter(prev, ligne); ecrirePanier(s); return s; });
    setPanierOuvert(true);
  }, []);

  const onQuantite = useCallback((cle, qty) => setLignes(prev => { const s = changerQuantite(prev, cle, qty); ecrirePanier(s); return s; }), []);
  const onRetirer  = useCallback((cle) => setLignes(prev => { const s = retirer(prev, cle); ecrirePanier(s); return s; }), []);
  const onVider    = useCallback(() => { vider(); setLignes([]); }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <AnnonceBar texte={reglages.annonce} />
      <Header collections={collections} nbArticles={nbArticles(lignes)} onOuvrirPanier={() => setPanierOuvert(true)} />

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
        onFermer={() => setPanierOuvert(false)} onQuantite={onQuantite} onRetirer={onRetirer}
      />
    </div>
  );
}
