import { createTesseractWorker } from '@/lib/ocr/tesseractConfig';

let tesseractWorker: any = null;

/**
 * Initialize Tesseract worker (lazy initialization)
 */
async function getWorker(selectedLanguages?: string[]) {
  if (!tesseractWorker) {
    console.log('=== TESSERACT INITIALIZATION START ===');
    console.log('Initializing Tesseract.js worker in offscreen document...');
    console.log('Offscreen document context:', {
      hasChrome: typeof chrome !== 'undefined',
      hasRuntime: typeof chrome !== 'undefined' && chrome.runtime,
      hasGetURL: typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL,
      runtimeId: typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime.id : undefined,
      userAgent: navigator.userAgent,
    });
    
    try {
      // Use provided languages or default to English
      const languagesToUse = selectedLanguages && selectedLanguages.length > 0 
        ? selectedLanguages 
        : ['eng'];
      console.log('Step 1: Using languages:', languagesToUse);
      
      console.log('Step 2: Importing tesseract.js...');
      const startTime = Date.now();
      
      // Step 3: Create worker with selected languages
      console.log('Step 3: Calling createTesseractWorker() with languages...');
      
      // Increased timeout to 120 seconds - local file loading can take time, especially for multiple languages
      // This timeout is a safety measure. If it triggers, the worker may still initialize successfully.
      // We don't log warnings to avoid cluttering the console - timeout is expected on slower systems
      tesseractWorker = await Promise.race([
        createTesseractWorker(languagesToUse),
        new Promise((_, reject) => 
          setTimeout(() => {
            // Silent timeout - no console warnings
            reject(new Error('TESSERACT_INIT_TIMEOUT'));
          }, 120000) // 120 seconds = 2 minutes
        ),
      ]).catch((error: any) => {
        // If timeout occurred, provide a user-friendly error message
        if (error?.message === 'TESSERACT_INIT_TIMEOUT') {
          throw new Error('Tesseract initialization is taking longer than expected. Please wait a moment and try again.');
        }
        // Re-throw other errors
        throw error;
      });
      const elapsed = Date.now() - startTime;
      console.log(`=== TESSERACT INITIALIZED SUCCESSFULLY in ${elapsed}ms ===`);
    } catch (error) {
      console.error('=== TESSERACT INITIALIZATION FAILED ===');
      console.error('Failed to initialize Tesseract worker:', error);
      const errorDetails = error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error;
      console.error('Error details:', errorDetails);
      throw error;
    }
  } else {
    console.log('Tesseract worker already initialized, reusing...');
  }
  return tesseractWorker;
}

/**
 * Process OCR on an image
 */
export async function processOCR(
  imageData: string | ImageData,
  onProgress?: (progress: number) => void,
  selectedLanguages?: string[]
): Promise<{ text: string; confidence: number }> {
  // Send initial progress (worker initialization)
  if (onProgress) {
    onProgress(0.01);
  }
  
  console.log('Getting Tesseract worker with languages:', selectedLanguages || ['eng']);
  let worker;
  try {
    worker = await getWorker(selectedLanguages);
    console.log('Tesseract worker obtained successfully');
  } catch (error) {
    console.error('Failed to get Tesseract worker:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Tesseract worker initialization failed: ${errorMessage}`);
  }
  
  // Send progress after worker is ready
  if (onProgress) {
    onProgress(0.15); // Worker ready, starting text extraction
  }
  
  try {
    console.log('Starting OCR text extraction...', {
      imageDataType: typeof imageData,
      isString: typeof imageData === 'string',
      isImageData: imageData instanceof ImageData,
    });
    
    // Add timeout for processing (2 minutes max)
    // NO LOGGER CALLBACK - it causes DataCloneError in workers
    // Tesseract.js workers cannot clone function callbacks
    // We'll send progress updates at key milestones instead
    const extractionPromise = worker.recognize(imageData);
    
    // Send intermediate progress updates during processing
    // Since we can't use logger callback, we'll estimate progress
    let progressStep = 0.15;
    let progressInterval: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    
    try {
      progressInterval = setInterval(() => {
        if (onProgress && progressStep < 0.95) {
          progressStep = Math.min(progressStep + 0.05, 0.95);
          onProgress(progressStep);
        }
      }, 2000); // Update every 2 seconds
      
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('OCR text extraction timeout after 2 minutes')), 120000);
      });
      
      const result = await Promise.race([extractionPromise, timeoutPromise]) as any;
      
      // Clear timers on success
      if (progressInterval) clearInterval(progressInterval);
      if (timeoutId) clearTimeout(timeoutId);
      
      if (onProgress) {
        onProgress(1.0);
      }
      
      console.log('OCR text extraction completed:', {
        textLength: result.data.text?.length || 0,
        confidence: result.data.confidence,
      });
      
      return {
        text: result.data.text || '',
        confidence: result.data.confidence || 0,
      };
    } catch (error) {
      // Ensure timers are always cleared on error
      if (progressInterval) clearInterval(progressInterval);
      if (timeoutId) clearTimeout(timeoutId);
      console.error('OCR processing error:', error);
      throw error;
    }
  } catch (error) {
    // Re-throw errors from inner try-catch
    throw error;
  }
}

/**
 * Cleanup worker
 */
export async function cleanupWorker() {
  if (tesseractWorker) {
    await tesseractWorker.terminate();
    tesseractWorker = null;
  }
}
