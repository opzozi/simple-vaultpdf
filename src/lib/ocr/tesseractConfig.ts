/**
 * Tesseract.js configuration for Chrome Extension
 * Uses LOCAL files for offline-first support
 */

/**
 * Check which language files are available
 */
export async function getAvailableLanguages(): Promise<string[]> {
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.getURL) {
    return ['eng']; // Default fallback
  }

  const baseUrl = chrome.runtime.getURL('tesseract/');
  const baseUrlPublic = chrome.runtime.getURL('public/tesseract/');
  const availableLanguages: string[] = [];

  // List of common languages to check
  const languagesToCheck = ['eng', 'hun', 'deu', 'fra', 'spa', 'ita', 'por', 'rus', 'chi_sim', 'jpn'];

  for (const lang of languagesToCheck) {
    const langFile = `${lang}.traineddata.gz`;
    const url1 = baseUrl + langFile;
    const url2 = baseUrlPublic + langFile;

    try {
      const response1 = await fetch(url1, { method: 'HEAD' });
      if (response1.ok) {
        availableLanguages.push(lang);
        continue;
      }
    } catch {}

    try {
      const response2 = await fetch(url2, { method: 'HEAD' });
      if (response2.ok) {
        availableLanguages.push(lang);
      }
    } catch {}
  }

  // Don't automatically add eng - let the user select it
  // If no languages are available, the system will fallback to 'eng' in createTesseractWorker
  return availableLanguages;
}

/**
 * Initialize Tesseract.js worker
 * Uses local files via chrome.runtime.getURL() for offline support
 * Language-independent: tries to use all available languages, falls back to English
 */
export const createTesseractWorker = async (preferredLanguages?: string[]) => {
  // Check if we're in a Chrome extension context
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.getURL) {
    throw new Error('Tesseract.js can only be initialized in a Chrome extension context');
  }

  // Dynamic import of tesseract.js
  const { createWorker } = await import('tesseract.js');
  
  console.log('Kísérlet a worker létrehozására...');
  
  // Get base URL for extension resources
  // Try 'tesseract/' first (as it exists in dist/), then fallback to 'public/tesseract/'
  const baseUrl = chrome.runtime.getURL('tesseract/');
  const baseUrlPublic = chrome.runtime.getURL('public/tesseract/');
  
  // Ellenőrizzük az útvonalakat (Látnod kell a konzolon!)
  const workerUrl = baseUrl + 'worker.min.js';
  const coreUrl = baseUrl + 'tesseract-core.wasm.js';
  const langUrl = baseUrl;
  
  console.log('Worker URL:', workerUrl);
  console.log('Core URL:', coreUrl);
  console.log('Lang URL:', langUrl);
  
  // Test file accessibility
  try {
    console.log('Testing file accessibility...');
    const testResponse = await fetch(workerUrl);
    console.log('FÁJL ÁLLAPOT:', testResponse.status, testResponse.statusText);
    if (!testResponse.ok) {
      throw new Error(`File not accessible: ${testResponse.status} ${testResponse.statusText}`);
    }
  } catch (fetchError) {
    console.error('NEM TALÁLOM:', fetchError);
    // Try public/tesseract/ path
    const workerUrlPublic = baseUrlPublic + 'worker.min.js';
    console.log('Trying public/tesseract/ path:', workerUrlPublic);
    const testResponse2 = await fetch(workerUrlPublic);
    console.log('FÁJL ÁLLAPOT (public/):', testResponse2.status, testResponse2.statusText);
    if (!testResponse2.ok) {
      throw new Error(`File not accessible in either location: ${testResponse2.status} ${testResponse2.statusText}`);
    }
  }
  
  // Get available languages
  const availableLanguages = await getAvailableLanguages();
  console.log('Available languages:', availableLanguages);

  // Determine which languages to use
  let languagesToUse: string;
  if (preferredLanguages && preferredLanguages.length > 0) {
    // Use preferred languages if available
    const availablePreferred = preferredLanguages.filter(lang => availableLanguages.includes(lang));
    if (availablePreferred.length > 0) {
      languagesToUse = availablePreferred.join('+');
    } else {
      // Fallback to English only if preferred languages are not available
      languagesToUse = 'eng';
    }
  } else {
    // Default to English only (user must explicitly select languages)
    languagesToUse = 'eng';
  }

  console.log(`Using languages: ${languagesToUse}`);

  // Try primary path first
  try {
    console.log(`Attempting to create Tesseract worker with LOCAL files (${languagesToUse})...`);
    const worker = await createWorker(languagesToUse, 1, {
      workerPath: workerUrl,
      corePath: coreUrl,
      langPath: langUrl,
      cachePath: langUrl,
      cacheMethod: 'none',
      gzip: true, // Files are .gz compressed
      workerBlobURL: false,
      errorHandler: (err: any) => console.error('Tesseract Internal Error:', err),
      logger: (m: any) => console.log(`[Tesseract Log]: ${m.status} - ${typeof m.progress === 'number' ? Math.round(m.progress * 100) : 0}%`),
    });
    
    console.log(`Worker created successfully! (${languagesToUse})`);
    return worker;
  } catch (primaryError) {
    console.warn('Failed with primary path, trying alternative path:', primaryError);
    
    // Fallback: try 'public/tesseract/' path
    const workerUrlAlt = baseUrlPublic + 'worker.min.js';
    const coreUrlAlt = baseUrlPublic + 'tesseract-core.wasm.js';
    const langUrlAlt = baseUrlPublic;
    
    try {
      console.log(`Attempting to create Tesseract worker with public/tesseract/ path (${languagesToUse})...`);
      const worker = await createWorker(languagesToUse, 1, {
        workerPath: workerUrlAlt,
        corePath: coreUrlAlt,
        langPath: langUrlAlt,
        cachePath: langUrlAlt,
        cacheMethod: 'none',
        gzip: true,
        workerBlobURL: false,
        errorHandler: (err: any) => console.error('Tesseract Internal Error:', err),
        logger: (m: any) => console.log(`[Tesseract Log]: ${m.status} - ${typeof m.progress === 'number' ? Math.round(m.progress * 100) : 0}%`),
      });
      
      console.log(`Worker created successfully! (${languagesToUse}, public/tesseract/)`);
      return worker;
    } catch (altError) {
      console.warn('Failed with alternative path, trying English only:', altError);
      
      // Final fallback: English only
      try {
        console.log('Attempting to create Tesseract worker with English only...');
        const worker = await createWorker('eng', 1, {
          workerPath: workerUrlAlt,
          corePath: coreUrlAlt,
          langPath: langUrlAlt,
          cachePath: langUrlAlt,
          cacheMethod: 'none',
          gzip: true,
          workerBlobURL: false,
          errorHandler: (err: any) => console.error('Tesseract Internal Error:', err),
          logger: (m: any) => console.log(`[Tesseract Log]: ${m.status} - ${typeof m.progress === 'number' ? Math.round(m.progress * 100) : 0}%`),
        });
        
        console.log('Worker created successfully! (eng only)');
        return worker;
      } catch (engError) {
        const errorMessage = engError instanceof Error ? engError.message : String(engError);
        const errorStack = engError instanceof Error ? engError.stack : undefined;
        console.error('Failed to create Tesseract worker with English only:', {
          message: errorMessage,
          stack: errorStack,
          error: engError,
        });
        throw new Error(`Failed to initialize Tesseract.js worker: ${errorMessage}`);
      }
    }
  }
};
