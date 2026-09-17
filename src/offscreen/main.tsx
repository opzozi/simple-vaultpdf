import React from 'react';
import ReactDOM from 'react-dom/client';
import '../assets/index.css';
import './worker-bridge';

chrome.runtime.sendMessage({ type: 'OFFSCREEN_READY' }).catch(() => {});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div style={{ display: 'none' }}>Offscreen Document</div>
  </React.StrictMode>
);
