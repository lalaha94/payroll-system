import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Legg til alias for enklere import
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    hmr: {
      overlay: false, // Deaktiver feilmeldingsoverlay hvis ønskelig
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': [
            'react',
            'react-dom',
            'react-router-dom',
            '@mui/material',
            '@mui/icons-material',
            '@supabase/supabase-js'
          ],
          'charts': ['recharts'],
          'utils': ['date-fns', 'lodash', 'xlsx']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
});
