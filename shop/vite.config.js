import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
