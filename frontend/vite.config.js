import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // Frontend runs on port 3000
  },
  build: {
    rollupOptions: {
      external: ['react-leaflet', 'leaflet'], // Ensures Rollup doesn't break
    },
  },
});
