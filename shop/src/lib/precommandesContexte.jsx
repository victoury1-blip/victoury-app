import { createContext, useContext } from 'react';

/* Réservations actives ({ [productId]: { date } }, voir precommande.js), mises
   à disposition de toutes les cartes produit sans les passer à chaque grille.
   Un contexte plutôt qu'une variable de module : les cartes sont mémoïsées
   (React.memo) et ne se redessineraient pas quand les réglages arrivent. */
export const PrecommandesContexte = createContext({});
export const usePrecommandes = () => useContext(PrecommandesContexte);
