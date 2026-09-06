import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(({mode}) => {
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    base: './', // CRITICAL for Electron
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      minify: false, // DESABILITAR MINIFICAÇÃO PARA ECONOMIZAR MEMÓRIA
      chunkSizeWarningLimit: 5000,
      rollupOptions: {
        output: {
          manualChunks: {
             'vendor-react': ['react', 'react-dom', 'react-router-dom'],
             'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
             'vendor-charts': ['recharts'],
          }
        }
      }
    }
  };
});