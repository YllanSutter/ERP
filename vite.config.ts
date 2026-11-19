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
  build: {
    rollupOptions: {
      output: {
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          if (!id.includes('/node_modules/')) return;
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
          if (id.includes('/node_modules/lucide-react/')) return 'icons';
          if (id.includes('/node_modules/recharts/')) return 'charts';
          if (id.includes('/node_modules/pdf-lib/')) return 'pdf';
          if (id.includes('/node_modules/@tiptap/')) return 'tiptap';
          if (id.includes('/node_modules/framer-motion/') || id.includes('/node_modules/motion-')) return 'motion';
          if (id.includes('/node_modules/@radix-ui/')) return 'radix';
        },
      },
    },
  },
});
