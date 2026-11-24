import React from 'react';
import { isStaleBundleError } from '../lib/bundleRecovery';

export default class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
    // Fichier d'une ancienne version introuvable après une mise en ligne :
    // réparation automatique (caches + rechargement), voir main.jsx.
    if (isStaleBundleError(error?.message)) {
      try { window.dispatchEvent(new CustomEvent('app:stale-bundle')); } catch { /* ignore */ }
    }
  }

  reessayer = () => {
    // « Réessayer » sur un fichier introuvable ne peut que rééchouer (React.lazy
    // garde l'échec en mémoire) : on recharge réellement l'application.
    if (isStaleBundleError(this.state.error?.message)) {
      const u = new URL(location.href);
      u.searchParams.set('_r', Date.now().toString());
      location.replace(u.toString());
      return;
    }
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full p-8">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
            <p className="text-red-600 font-bold text-lg mb-2">Oups, une erreur est survenue</p>
            <p className="text-sm text-red-500 mb-4">{this.state.error?.message || 'Erreur inconnue'}</p>
            <button
              onClick={this.reessayer}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700"
            >
              Réessayer
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
