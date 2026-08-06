import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/* Identifiant de build affiché dans Réglages. Il permet de vérifier d'un coup
   d'œil quelle version tourne réellement sur un appareil — sans quoi on ne peut
   pas distinguer « le correctif ne marche pas » de « le navigateur sert encore
   l'ancien cache ». Sur Vercel, le SHA du commit est fourni par l'environnement. */
const BUILD_ID = (process.env.VERCEL_GIT_COMMIT_SHA || 'local').slice(0, 7)
  + ' · ' + new Date().toISOString().slice(0, 16).replace('T', ' ');

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
  plugins: [
    react(),
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
