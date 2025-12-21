import { defineManifest } from '@crxjs/vite-plugin';
import packageJson from './package.json';

export default defineManifest({
  manifest_version: 3,
  name: 'Simple VaultPDF',
  short_name: 'VaultPDF',
  version: packageJson.version,
  description: 'Secure, local-first PDF editor. Edit, merge, split, OCR text extraction, and manage PDFs offline. No cloud, no subscriptions.',
  author: 'Simple VaultPDF Team',
  homepage_url: 'https://github.com/opzozi/simple-vault-pdf',
  // Note: support_url is not a valid manifest key - set it in Chrome Web Store Developer Dashboard instead
  permissions: [
    'storage',
    'offscreen',
    'unlimitedStorage',
    // 'tabs' removed - chrome.tabs.create() works without tabs permission in MV3
  ],
  action: {
    default_popup: 'src/popup/index.html',
    default_icon: {
      16: 'public/icon-16.png',
      48: 'public/icon-48.png',
      128: 'public/icon-128.png',
    },
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_security_policy: {
    // Note: blob: is NOT allowed in worker-src for Manifest V3 CSP
    // Tesseract.js is configured with workerBlobURL: false, so blob URLs are not needed
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; worker-src 'self' 'wasm-unsafe-eval';",
  },
  web_accessible_resources: [
    {
      resources: [
        // PDF.js worker (required for PDF rendering)
        'public/pdf.worker.min.mjs',
        'pdf.worker.min.mjs',
        // Tesseract.js files
        'tesseract/*',
        // Explicit file paths for clarity (both .gz and non-.gz if needed)
        'tesseract/worker.min.js',
        'tesseract/tesseract-core.wasm.js',
        'tesseract/eng.traineddata.gz',
        'tesseract/hun.traineddata.gz',
        // Fallback paths (build may place files in public/tesseract/)
        'public/tesseract/*',
        'public/tesseract/worker.min.js',
        'public/tesseract/tesseract-core.wasm.js',
        'public/tesseract/eng.traineddata.gz',
        'public/tesseract/hun.traineddata.gz',
      ],
      matches: ['<all_urls>'],
    },
  ],
  icons: {
    16: 'public/icon-16.png',
    48: 'public/icon-48.png',
    128: 'public/icon-128.png',
  },
});

