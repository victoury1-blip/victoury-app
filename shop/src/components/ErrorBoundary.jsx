import React from 'react';

// Chaque page (Accueil, Collection, Commander...) est chargée en chunk séparé
// (lazy + Suspense, voir App.jsx) — un chunk d'une ANCIENNE build peut ne
// plus exister sur le serveur après un nouveau déploiement (le fichier a été
// remplacé par un autre au nom différent). Un client qui avait déjà l'onglet
// ouvert et navigue alors vers cette page voit son import échouer, et sans
// error boundary React démonte tout l'arbre en dessous : page blanche, sans
// aucun moyen de s'en sortir sans deviner qu'il faut recharger à la main.
//
// Un seul rechargement automatique suffit à récupérer la nouvelle build —
// le drapeau en sessionStorage évite une boucle si l'erreur n'était pas liée
// à un chunk périmé (dans ce cas, le message de secours reste affiché).
export default class ErrorBoundary extends React.Component {
  state = { erreur: null };

  static getDerivedStateFromError(erreur) {
    return { erreur };
  }

  componentDidCatch(erreur) {
    const estErreurDeChunk = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(erreur?.message || '');
    if (!estErreurDeChunk) return;
    const cle = 'reload-apres-erreur-chunk';
    if (sessionStorage.getItem(cle)) return; // déjà tenté une fois, on n'insiste pas
    sessionStorage.setItem(cle, '1');
    window.location.reload();
  }

  render() {
    if (this.state.erreur) {
      return (
        <div className="min-h-screen grid place-items-center px-6 text-center">
          <div>
            <p className="text-sm text-gray-500">Un problème est survenu au chargement de la page.</p>
            <button onClick={() => window.location.reload()}
              className="mt-4 border border-ink px-6 py-2.5 text-[11px] tracking-widest uppercase">
              Recharger la page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
