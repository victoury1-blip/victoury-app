import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite place la feuille de style compilée tout à la fin du <head>, après le
// script du module principal et les deux gros "modulepreload" (vendor,
// supabase — plus de 350 Kio à eux deux) : sur une connexion lente, le
// navigateur se met à télécharger ces deux gros fichiers avant même de
// découvrir la feuille de style qui bloque pourtant le premier rendu —
// PageSpeed le signalait comme une requête de blocage du rendu qui traîne.
// Ce petit plugin déplace juste ce <link rel="stylesheet"> tout en haut du
// <head>, pour qu'il soit découvert et demandé en tout premier.
function stylesheetEnPremier() {
  return {
    name: 'stylesheet-en-premier',
    transformIndexHtml(html) {
      const re = /\s*<link rel="stylesheet"[^>]*>/;
      const m = html.match(re);
      if (!m) return html;
      // Juste après <meta charset>, jamais avant : les navigateurs veulent
      // cette balise en tout premier dans le <head> pour détecter
      // l'encodage sans ambiguïté.
      return html.replace(re, '').replace(/(<meta charset="[^"]*"\s*\/?>)/, `$1\n    ${m[0].trim()}`);
    },
  };
}

export default defineConfig({
  plugins: [react(), stylesheetEnPremier()],
  test: { environment: 'jsdom' },
  build: {
    // 'esnext' plutôt que la cible par défaut de Vite (déjà moderne, mais
    // pensée pour couvrir jusqu'à Safari un peu ancien) : sans polyfills ni
    // transformations de compatibilité inutiles pour l'immense majorité des
    // visiteurs (navigateurs à jour), ce que PageSpeed signalait comme
    // "JavaScript ancien" envoyé pour rien.
    target: 'esnext',
    rollupOptions: {
      output: {
        // Le code des librairies change bien moins souvent que le code du
        // site : les séparer laisse le navigateur garder ce gros chunk en
        // cache d'une visite à l'autre, même après un déploiement qui n'a
        // touché que du code applicatif.
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
