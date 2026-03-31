import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
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
