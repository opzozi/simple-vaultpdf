// Worker bridge for handling messages between service worker and offscreen document
// This handles OCR and heavy PDF processing

import { processOCR } from './ocr-processor';

// Handle messages from background script
chrome.runtime.onMessage.addListener((message) => {
  console.log('Offscreen document received message:', message.type);
  
  if (message.type === 'OCR_PROCESS') {
    console.log('Processing OCR request...');
    // Don't use sendResponse for long-running operations
    // Use chrome.runtime.sendMessage() instead
    handleOCRRequest(message);
    // Return false - we're not using sendResponse
    return false;
  }
  
  return false;
});

console.log('Offscreen document message listener registered');

async function handleOCRRequest(message: any) {
  const { imageData, pageNumber, requestId, selectedLanguages } = message;
  
  console.log('=== OCR REQUEST RECEIVED ===');
  console.log('OCR request received in offscreen:', { 
    pageNumber, 
    requestId, 
    hasImageData: !!imageData, 
    imageDataLength: imageData?.length,
    selectedLanguages: selectedLanguages || ['eng']
  });
  
  // Store requestId for progress updates
  let currentRequestId = requestId;
  
  // Helper to send progress - use chrome.runtime.sendMessage() only
  const sendProgress = (progress: number, message?: string) => {
    if (message) console.log(message);
    chrome.runtime.sendMessage({
      type: 'OCR_PROGRESS',
      progress,
      requestId: currentRequestId,
      pageNumber,
    }).catch((err) => {
      // Silently ignore errors - message channel might be closed
      console.warn('Failed to send progress (channel may be closed):', err.message);
    });
  };
  
  try {
    // Send initial progress immediately
    sendProgress(0.01, 'Sending initial progress...');
    
    // Send progress updates with requestId
    const progressCallback = (progress: number) => {
      console.log('OCR progress callback:', progress);
      sendProgress(progress);
    };
    
    console.log('Starting OCR processing with languages:', selectedLanguages || ['eng']);
    
    // Process OCR with timeout and selected languages
    const ocrPromise = processOCR(imageData, progressCallback, selectedLanguages || ['eng']);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('OCR processing timeout after 2 minutes')), 120000)
    );
    
    const result = await Promise.race([ocrPromise, timeoutPromise]) as any;
    console.log('OCR processing completed:', { textLength: result.text.length, confidence: result.confidence });
    
    // Send result back to background script using chrome.runtime.sendMessage()
    // Don't use sendResponse - message channel may be closed
    chrome.runtime.sendMessage({
      type: 'OCR_RESPONSE',
      success: true,
      text: result.text,
      confidence: result.confidence,
      pageNumber,
      requestId: currentRequestId,
    }).catch((error) => {
      console.error('Failed to send OCR response:', error);
    });
  } catch (error) {
    console.error('OCR processing failed:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Error details:', { errorMessage, errorStack });
    
    // Send error to background script using chrome.runtime.sendMessage()
    // Don't use sendResponse - message channel may be closed
    chrome.runtime.sendMessage({
      type: 'OCR_RESPONSE',
      success: false,
      error: errorMessage,
      pageNumber,
      requestId: currentRequestId,
    }).catch((error) => {
      console.error('Failed to send OCR error response:', error);
    });
  }
}
