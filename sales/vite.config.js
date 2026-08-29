import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Standalone app — deployed separately (Vercel), not part of the
// frontendall module-federation setup. Port 5177 matches the backend's
// SALES_CHAT_FRONTEND_URL default (see backend/src/config/env.js).
export default defineConfig({
  plugins: [react()],
  server: { port: 5177 },
});
