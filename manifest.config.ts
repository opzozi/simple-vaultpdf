import { defineManifest } from '@crxjs/vite-plugin';
import packageJson from './package.json';

export default defineManifest({
  manifest_version: 3,
  name: 'Simple VaultPDF',
  short_name: 'VaultPDF',
  version: packageJson.version,
  description: 'Local PDF editor. Merge, rotate, extract text, OCR scanned pages. Files stay on your device.',
  author: 'opzozi',
  homepage_url: 'https://github.com/opzozi/simple-vaultpdf',
  permissions: [
    'storage',
    'offscreen',
    'unlimitedStorage',
  ],
  action: {
    default_popup: 'src/popup/index.html',
    default_icon: {
      16: 'icon-16.png',
      48: 'icon-48.png',
      128: 'icon-128.png',
    },
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; worker-src 'self' 'wasm-unsafe-eval';",
  },
  icons: {
    16: 'icon-16.png',
    48: 'icon-48.png',
    128: 'icon-128.png',
  },
});
