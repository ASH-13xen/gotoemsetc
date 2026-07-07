import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import federation from '@originjs/vite-plugin-federation'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Exposes this app's root component so frontendall can mount it in-page
    // as a micro-frontend. Purely additive — standalone `vite dev` behavior
    // (port, proxy, routes) is unchanged.
    federation({
      name: 'frontendfollowups',
      filename: 'remoteEntry.js',
      exposes: { './App': './src/App.tsx' },
      // react-router-dom is deliberately NOT shared: this remote renders its
      // own <BrowserRouter> when mounted standalone or inside frontendall, and
      // a truly shared router module makes React Router's nested-<Router>
      // detection fire across the module boundary. Keeping it un-shared gives
      // each app its own isolated router instance instead.
      shared: ['react', 'react-dom'],
    }),
  ],
  build: {
    target: 'esnext',
    modulePreload: false,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        // Stable, predictable filename so frontendall can statically link
        // this remote's stylesheet (the federation plugin's own dynamic CSS
        // injection is broken under Vite 8 — see scripts/fixRemoteEntry.cjs).
        assetFileNames: (assetInfo) =>
          assetInfo.names?.[0]?.endsWith('.css') ? 'assets/remote-style.css' : 'assets/[name]-[hash][extname]',
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5175,
    proxy: {
      '/api': {
        target: 'http://localhost:5050',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 5175,
    proxy: {
      '/api': {
        target: 'http://localhost:5050',
        changeOrigin: true,
      },
    },
  },
})
