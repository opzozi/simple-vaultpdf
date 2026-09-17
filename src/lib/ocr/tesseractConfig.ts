/**
 * Tesseract.js configuration for Chrome Extension.
 * Bundled tessdata_fast models live in tesseract/; extra languages come from IndexedDB.
 */

import {
  clearBundledTesseractCache,
  getAvailableLanguageCodes,
  isBundledLanguage,
  seedTesseractCache,
} from './languagePacks';

export async function getAvailableLanguages(): Promise<string[]> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.getURL) {
    return ['eng'];
  }
  return getAvailableLanguageCodes();
}

export const createTesseractWorker = async (preferredLanguages?: string[]) => {
  if (typeof chrome === 'undefined' || !chrome.runtime?.getURL) {
    throw new Error('Tesseract.js can only be initialized in a Chrome extension context');
  }

  const { createWorker } = await import('tesseract.js');
  const baseUrl = chrome.runtime.getURL('tesseract/');
  const workerUrl = `${baseUrl}worker.min.js`;
  const coreUrl = `${baseUrl}tesseract-core-lstm.wasm.js`;

  const workerResponse = await fetch(workerUrl);
  if (!workerResponse.ok) {
    throw new Error(`Tesseract worker is not accessible: ${workerResponse.status}`);
  }

  const availableLanguages = await getAvailableLanguages();
  let languagesToUse = 'eng';

  if (preferredLanguages && preferredLanguages.length > 0) {
    const availablePreferred = preferredLanguages.filter((lang) => availableLanguages.includes(lang));
    if (availablePreferred.length > 0) {
      languagesToUse = availablePreferred.join('+');
    }
  }

  const selectedCodes = languagesToUse.split('+');
  try {
    await clearBundledTesseractCache();
    const downloadedCodes = selectedCodes.filter((code) => !isBundledLanguage(code));
    if (downloadedCodes.length > 0) {
      await seedTesseractCache(downloadedCodes);
    }
  } catch (cacheError) {
    console.warn('OCR language cache sync failed:', cacheError);
  }

  const worker = await createWorker(languagesToUse, 1, {
    workerPath: workerUrl,
    corePath: coreUrl,
    langPath: baseUrl,
    gzip: true,
    cacheMethod: 'write',
    workerBlobURL: false,
    errorHandler: (err: unknown) => console.error('Tesseract Internal Error:', err),
  });

  return worker;
};
