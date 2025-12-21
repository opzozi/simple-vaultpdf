import React from 'react';
import ReactDOM from 'react-dom/client';
import '../assets/index.css';
import './worker-bridge';

// Minimal React setup for offscreen document
// This document runs in the background for OCR processing

console.log('Offscreen document loaded and ready for OCR processing');

// Test file accessibility
(async () => {
  try {
    const testUrl = chrome.runtime.getURL('tesseract/worker.min.js');
    console.log('Testing file accessibility:', testUrl);
    const response = await fetch(testUrl);
    console.log('FÁJL ÁLLAPOT:', response.status, response.statusText);
    if (!response.ok) {
      // Try public/tesseract/ path
      const testUrl2 = chrome.runtime.getURL('public/tesseract/worker.min.js');
      console.log('Trying public/tesseract/ path:', testUrl2);
      const response2 = await fetch(testUrl2);
      console.log('FÁJL ÁLLAPOT (public/):', response2.status, response2.statusText);
    }
  } catch (e) {
    console.error('NEM TALÁLOM:', e);
  }
})();

// Test message sending capability
chrome.runtime.sendMessage({ type: 'OFFSCREEN_READY' }).catch(() => {
  // Ignore if no listener
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div style={{ display: 'none' }}>Offscreen Document - OCR Processing</div>
  </React.StrictMode>
);

