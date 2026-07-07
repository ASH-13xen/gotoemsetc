import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import federation from '@originjs/vite-plugin-federation'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // vite.config.ts runs in Node, not the browser, so the remotes' URLs (used
  // below, at config-eval time) need an explicit loadEnv call — import.meta.env
  // only auto-populates in application code. Locally this reads .env
  // (localhost defaults); on Vercel the dashboard-configured env vars take
  // precedence automatically.
  const env = loadEnv(mode, process.cwd(), '')
  const emsUrl = env.VITE_EMS_URL || 'http://localhost:5173'
  const salesUrl = env.VITE_SALES_URL || 'http://localhost:5174'
  const followupsUrl = env.VITE_FOLLOWUPS_URL || 'http://localhost:5175'

  return {
    plugins: [
      react(),
      tailwindcss(),
      // Consumes the three sibling apps as micro-frontends. Each remote must be
      // running its production build (`vite build` + `vite preview` locally, or
      // simply deployed on Vercel) for its remoteEntry.js to exist.
      federation({
        name: 'frontendall',
        remotes: {
          frontendems: `${emsUrl}/assets/remoteEntry.js`,
          frontendsales: `${salesUrl}/assets/remoteEntry.js`,
          frontendfollowups: `${followupsUrl}/assets/remoteEntry.js`,
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
  }
})
