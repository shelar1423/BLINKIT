import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const PORT = Number(process.env.PORT) || 5180;

export default defineConfig({
  plugins: [react()],
  server: { host: true, port: PORT },
  preview: { host: true, port: PORT },
  build: {
    target: 'es2020',
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'], react: ['react', 'react-dom', 'react-router-dom'] },
      },
    },
  },
});
