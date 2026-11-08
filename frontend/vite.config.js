import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo, /api se reenvía al backend: el navegador ve un solo origen
// y no hace falta configurar CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': process.env.VITE_API_URL ?? 'http://localhost:4000',
    },
  },
});
