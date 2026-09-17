// Service Worker entry point for Simple VaultPDF

let offscreenDocumentCreated = false;
let offscreenDocumentReady = false;
let offscreenReadyPromise: Promise<void> | null = null;

async function ensureOffscreenDocument(): Promise<void> {
  if (offscreenDocumentReady) {
    return;
  }

  // If we're already waiting for ready, return that promise
  if (offscreenReadyPromise) {
    return offscreenReadyPromise;
  }

  // Create new promise for ready state
  offscreenReadyPromise = new Promise((resolve) => {
    // Set up one-time listener for OFFSCREEN_READY message
    const readyListener = (message: any) => {
      if (message.type === 'OFFSCREEN_READY') {
        chrome.runtime.onMessage.removeListener(readyListener);
        offscreenDocumentReady = true;
        resolve();
      }
    };
    
    chrome.runtime.onMessage.addListener(readyListener);
    
    // Create the document
    if (!offscreenDocumentCreated) {
      chrome.offscreen.createDocument({
        url: 'src/offscreen/index.html',
        reasons: ['DOM_SCRAPING' as chrome.offscreen.Reason],
        justification: 'Need DOM access for OCR and PDF processing with Tesseract.js',
      }).then(() => {
        offscreenDocumentCreated = true;
        // Wait up to 5 seconds for ready signal
        setTimeout(() => {
          if (!offscreenDocumentReady) {
            console.warn('Offscreen document ready signal timeout, proceeding anyway...');
            chrome.runtime.onMessage.removeListener(readyListener);
            offscreenDocumentReady = true;
            resolve();
          }
        }, 5000);
      }).catch((error) => {
        // Document might already exist
        if (error.message.includes('offscreen document already exists')) {
          offscreenDocumentCreated = true;
          // Wait up to 5 seconds for ready signal
          setTimeout(() => {
            if (!offscreenDocumentReady) {
              console.warn('Offscreen document ready signal timeout, proceeding anyway...');
              chrome.runtime.onMessage.removeListener(readyListener);
              offscreenDocumentReady = true;
              resolve();
            }
          }, 5000);
        } else {
          console.error('Failed to create offscreen document:', error);
          chrome.runtime.onMessage.removeListener(readyListener);
          offscreenDocumentReady = true; // Proceed anyway
          resolve();
        }
      });
    } else {
      // Document already created, just wait for ready
      setTimeout(() => {
        if (!offscreenDocumentReady) {
          console.warn('Offscreen document ready signal timeout, proceeding anyway...');
          chrome.runtime.onMessage.removeListener(readyListener);
          offscreenDocumentReady = true;
          resolve();
        }
      }, 5000);
    }
  });

  return offscreenReadyPromise;
}

// Handle messages from popup, app, and offscreen document
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'OPEN_OFFSCREEN') {
    ensureOffscreenDocument().then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      console.error('Failed to create offscreen document:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  
  // Handle OFFSCREEN_READY message
  if (message.type === 'OFFSCREEN_READY') {
    return true;
  }
  
  if (message.type === 'OCR_REQUEST') {
    // Ensure offscreen document exists and is ready, then forward request
    ensureOffscreenDocument().then(() => {
      // Add small delay to ensure message listener is registered
      setTimeout(() => {
        // Store sender info for response
        const requestId = message.requestId;
        
        // Set up one-time listener for OCR response from offscreen
        const responseListener = (response: any) => {
          if (response.type === 'OCR_RESPONSE' && response.requestId === requestId) {
            chrome.runtime.onMessage.removeListener(responseListener);
            
            // Forward to UI
            chrome.runtime.sendMessage({
              type: 'OCR_RESPONSE',
              ...response,
            }).catch(() => {
              // Ignore errors if no listeners
            });
          }
        };
        
        chrome.runtime.onMessage.addListener(responseListener);
        
        // Forward OCR request to offscreen document with selected languages
        chrome.runtime.sendMessage({
          type: 'OCR_PROCESS',
          imageData: message.imageData,
          pageNumber: message.pageNumber,
          requestId: requestId,
          selectedLanguages: message.selectedLanguages || ['eng'],
        }).catch((error) => {
          chrome.runtime.onMessage.removeListener(responseListener);
          console.error('Error forwarding OCR request:', error);
          chrome.runtime.sendMessage({
            type: 'OCR_ERROR',
            error: error.message,
            requestId: requestId,
          }).catch(() => {});
        });
      }, 100); // 100ms delay to ensure listener is registered
    }).catch((error) => {
      console.error('Failed to ensure offscreen document:', error);
      chrome.runtime.sendMessage({
        type: 'OCR_ERROR',
        error: error.message,
        requestId: message.requestId,
      }).catch(() => {});
    });
    
    // Return false - we're not using sendResponse, using chrome.runtime.sendMessage() instead
    return false;
  }
  
  if (message.type === 'OCR_PROGRESS') {
    // Forward progress updates to UI (from offscreen)
    chrome.runtime.sendMessage({
      type: 'OCR_PROGRESS',
      progress: message.progress,
      requestId: message.requestId,
      pageNumber: message.pageNumber,
    }).catch(() => {
      // Ignore errors if no listeners
    });
    // Return false - we're not using sendResponse
    return false;
  }
  
  return false;
});
