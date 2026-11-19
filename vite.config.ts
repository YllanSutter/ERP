import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Vite config for React + TypeScript
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/socket.io': { target: 'http://localhost:4000', ws: true, changeOrigin: true },
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  // Let Rollup split the graph at dynamic imports. Package-based manual chunks
  // can split dependency cycles (e.g. Recharts/d3) across initialization order.
});
