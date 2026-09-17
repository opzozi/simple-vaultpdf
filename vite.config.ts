import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';
import path from 'path';

function stripHtmlCrossOrigin(): Plugin {
  return {
    name: 'strip-html-crossorigin',
    enforce: 'post',
    transformIndexHtml(html) {
      return html
        .replace(/<link rel="modulepreload"[^>]*>/g, '')
        .replace(/\s+crossorigin(="[^"]*")?/g, '');
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    crx({ 
      manifest,
      contentScripts: {
        injectCss: true,
      },
    }),
    stripHtmlCrossOrigin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  },
  build: {
    modulePreload: false,
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, 'src/popup/index.html'),
        app: path.resolve(__dirname, 'src/app/index.html'),
        offscreen: path.resolve(__dirname, 'src/offscreen/index.html'),
      },
    },
  },
});

