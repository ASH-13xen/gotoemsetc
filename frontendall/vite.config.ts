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
    // Consumes the three sibling apps as micro-frontends. Each remote must be
    // running its production build (`vite build` + `vite preview`, not plain
    // `vite dev`) for its remoteEntry.js to exist.
    federation({
      name: 'frontendall',
      remotes: {
        frontendems: 'http://localhost:5173/assets/remoteEntry.js',
        frontendsales: 'http://localhost:5174/assets/remoteEntry.js',
        frontendfollowups: 'http://localhost:5175/assets/remoteEntry.js',
      },
      // Matches the remotes: react-router-dom/react-query are NOT shared so
      // each app keeps its own isolated router instance (see remotes' configs).
      shared: ['react', 'react-dom'],
    }),
  ],
  build: {
    target: 'esnext',
    modulePreload: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5176,
    proxy: {
      '/api': {
        target: 'http://localhost:5050',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 5176,
    proxy: {
      '/api': {
        target: 'http://localhost:5050',
        changeOrigin: true,
      },
    },
  },
})
