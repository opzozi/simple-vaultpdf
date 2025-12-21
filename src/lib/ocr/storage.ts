/**
 * Chrome Storage utilities for OCR settings
 */

const STORAGE_KEY_OCR_SETTINGS = 'ocr_settings';

export interface OcrSettings {
  selectedLanguages: string[];
  batchSize: number; // Number of pages to process in parallel
  deletedLanguages?: string[]; // Languages that user has deleted (hidden from UI)
}

const DEFAULT_SETTINGS: OcrSettings = {
  selectedLanguages: ['eng'], // Default to English only
  batchSize: 3, // Process 3 pages in parallel
};

/**
 * Get OCR settings from Chrome storage
 */
export async function getOcrSettings(): Promise<OcrSettings> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([STORAGE_KEY_OCR_SETTINGS], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Error getting OCR settings:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else if (result[STORAGE_KEY_OCR_SETTINGS]) {
        resolve(result[STORAGE_KEY_OCR_SETTINGS]);
      } else {
        resolve(DEFAULT_SETTINGS);
      }
    });
  });
}

/**
 * Save OCR settings to Chrome storage
 */
export async function saveOcrSettings(settings: Partial<OcrSettings>): Promise<void> {
  const current = await getOcrSettings();
  const updated = { ...current, ...settings };
  
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEY_OCR_SETTINGS]: updated }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Get selected languages
 */
export async function getSelectedLanguages(): Promise<string[]> {
  const settings = await getOcrSettings();
  return settings.selectedLanguages;
}

/**
 * Set selected languages
 */
export async function setSelectedLanguages(languages: string[]): Promise<void> {
  // Ensure at least one language is selected
  if (languages.length === 0) {
    console.warn('Cannot set empty language list, defaulting to English');
    languages = ['eng'];
  }
  
  console.log('Setting selected languages:', languages);
  await saveOcrSettings({ selectedLanguages: languages });
  
  // Verify it was saved
  const saved = await getSelectedLanguages();
  console.log('Verified saved languages:', saved);
}

/**
 * Get deleted languages (languages user has removed from UI)
 */
export async function getDeletedLanguages(): Promise<string[]> {
  const settings = await getOcrSettings();
  return settings.deletedLanguages || [];
}

/**
 * Add a language to the deleted list
 */
export async function addDeletedLanguage(code: string): Promise<void> {
  const settings = await getOcrSettings();
  const deleted = settings.deletedLanguages || [];
  if (!deleted.includes(code)) {
    await saveOcrSettings({ deletedLanguages: [...deleted, code] });
  }
}

/**
 * Remove a language from the deleted list (if user re-downloads it)
 */
export async function removeDeletedLanguage(code: string): Promise<void> {
  const settings = await getOcrSettings();
  const deleted = settings.deletedLanguages || [];
  if (deleted.includes(code)) {
    await saveOcrSettings({ deletedLanguages: deleted.filter(l => l !== code) });
  }
}

