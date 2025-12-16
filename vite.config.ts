import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(), // React 專案用這個
    VitePWA({
      registerType: 'autoUpdate', // 自動更新 Service Worker
      manifest: {
        name: 'ZenFlow 訂課系統',
        short_name: 'ZenFlow',
        start_url: './index.html',
        scope: './',
        display: 'standalone',
        background_color: '#f4f7f6',
        theme_color: '#568479',
        orientation: 'portrait',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})
