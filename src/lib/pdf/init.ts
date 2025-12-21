import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker for Chrome Extension (Manifest V3)
// We use the worker file from public/ directory
if (typeof window !== 'undefined' && typeof chrome !== 'undefined' && chrome.runtime) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('public/pdf.worker.min.mjs');
}

export { pdfjsLib };

