import * as pdfjsLib from 'pdfjs-dist';

if (typeof window !== 'undefined' && typeof chrome !== 'undefined' && chrome.runtime) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.mjs');
}

export { pdfjsLib };
