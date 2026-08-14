import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/* Identifiant de build affiché dans Réglages. Il permet de vérifier d'un coup
   d'œil quelle version tourne réellement sur un appareil — sans quoi on ne peut
   pas distinguer « le correctif ne marche pas » de « le navigateur sert encore
   l'ancien cache ». Sur Vercel, le SHA du commit est fourni par l'environnement. */
const BUILD_ID = (process.env.VERCEL_GIT_COMMIT_SHA || 'local').slice(0, 7)
  + ' · ' + new Date().toISOString().slice(0, 16).replace('T', ' ');

/* Écrit /version.txt à la racine du site. Ce fichier n'est PAS mis en cache par
   le Service Worker (son extension n'est pas dans globPatterns) : l'ouvrir dans
   le navigateur montre donc la version réellement servie par l'hébergeur, ce qui
   permet de distinguer « le déploiement n'a pas eu lieu » de « l'appareil sert
   un cache périmé ». */
const versionFilePlugin = {
  name: 'emit-version-txt',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.txt', source: BUILD_ID + '\n' });
  },
};

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
  plugins: [
    react(),
    versionFilePlugin,
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'apple-touch-icon-512.png'],
      manifest: {
        name: 'VICTOURY - Gestion des Commandes',
        short_name: 'VICTOURY',
        description: 'Gestion des commandes et livraisons',
        theme_color: '#1E3A5F',
        background_color: '#F9FAFB',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'portrait',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/wc-api/, /^\/chic-api/, /^\/api\//, /^\/ozone-/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        /* Découpage explicite. Laissé à lui-même, Rollup fond les modules
         * partagés dans le fichier principal ; une page chargée à la demande en
         * dépend alors PAR ce fichier, lequel importe déjà la page. Les deux
         * s'attendent l'un l'autre et une constante est lue avant d'exister
         * (« Cannot access 'x' before initialization »), sur une page au hasard
         * et en production seulement.
         *
         * `lib`, `data` et `hooks` n'importent AUCUN composant (un test le
         * vérifie) : les regrouper à part ne peut donc refermer aucune boucle,
         * puisque rien n'y renvoie vers le fichier principal. */
        manualChunks(id) {
          const path = id.replace(/\\/g, '/');
          /* Les dépendances externes restent réparties par Rollup : les
             regrouper de force recréait une boucle avec ce fichier. */
          if (path.includes('/node_modules/')) return undefined;
          if (/\/src\/(lib|data|hooks)\//.test(path)) return 'app-shared';
          return undefined;
        },
      },
    },
  },
  server: {
    proxy: {
      '/wc-api': {
        target: 'https://victoury-maroc.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/wc-api/, ''),
      },
      '/chic-api': {
        target: 'https://www.chic-affiliate.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/chic-api/, ''),
      },
    },
  },
})
