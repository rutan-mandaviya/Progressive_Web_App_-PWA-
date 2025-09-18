import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const isDev = process.env.NODE_ENV === 'development'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: !isDev, // dev me disable, sirf prod me enable
      },
      manifest: {
        name: 'Ramban App',
        short_name: 'Ramban',
        description: '⚡ A blazing fast Progressive Web App built with React + Vite',
        theme_color: '#64c72e',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'en',
        dir: 'ltr',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Open Dashboard',
            short_name: 'Dashboard',
            description: 'Jump to your dashboard',
            url: '/dashboard',
            icons: [{ src: 'icons/icon-192x192.png', sizes: '192x192' }]
          },
          {
            name: 'New Task',
            short_name: 'Task',
            description: 'Create a new task instantly',
            url: '/task/new',
            icons: [{ src: 'icons/icon-192x192.png', sizes: '192x192' }]
          }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'document',
            handler: 'NetworkFirst',
            options: { cacheName: 'html-cache' }
          },
          {
            urlPattern: ({ request }) => request.destination === 'script' || request.destination === 'style',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'assets-cache' }
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 }
            }
          },
          {
            urlPattern: /\/api\/.*\/*.json/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 30, maxAgeSeconds: 24 * 60 * 60 }
            }
          }
        ]
      }
    })
  ]
})
