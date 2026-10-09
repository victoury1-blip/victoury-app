import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { chargerProduit } from '../lib/catalog';
import Produit from './Produit';
import PageStatique from './PageStatique';

/* Une seule adresse racine ("victoury-maroc.com/<nom>") sert DEUX choses
 * différentes selon ce qui porte ce slug :
 *   - un produit "non listé" (landing page de pub, voir LandingVente.jsx) —
 *     son slug sert alors d'adresse courte, sans le préfixe /product/ ;
 *   - sinon, une page statique classique (CGV, livraison…) comme avant.
 * On vérifie donc d'abord le catalogue produit avant de retomber sur l'ancien
 * comportement (page statique), pour ne rien casser des adresses existantes.
 */
export default function SlugRouter(produitProps) {
  const { slug } = useParams();
  const [estLanding, setEstLanding] = useState(undefined);

  useEffect(() => {
    setEstLanding(undefined);
    chargerProduit(slug).then(p => setEstLanding(!!(p && p.unlisted))).catch(() => setEstLanding(false));
  }, [slug]);

  if (estLanding === undefined) {
    return <div className="max-w-3xl mx-auto px-6 py-24 animate-pulse"><div className="h-64 bg-gray-100" /></div>;
  }
  return estLanding ? <Produit {...produitProps} /> : <PageStatique />;
}
