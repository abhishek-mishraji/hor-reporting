import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5183,
    strictPort: true,
    proxy: {
      '/api/auth': {
        target: 'http://127.0.0.1:8091',
        changeOrigin: false,
      },
      '/svc/verifone': {
        target: 'http://127.0.0.1:8094',
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/svc\/verifone/, ''),
      },
      '/svc/gilbarco': {
        target: 'http://127.0.0.1:8095',
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/svc\/gilbarco/, ''),
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
