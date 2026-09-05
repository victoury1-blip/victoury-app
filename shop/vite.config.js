import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom' },
  build: {
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
