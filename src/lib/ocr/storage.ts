const STORAGE_KEY_OCR_SETTINGS = 'ocr_settings';

export interface OcrSettings {
  selectedLanguages: string[];
  batchSize: number;
}

const DEFAULT_SETTINGS: OcrSettings = {
  selectedLanguages: ['eng'],
  batchSize: 3,
};

export async function getOcrSettings(): Promise<OcrSettings> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([STORAGE_KEY_OCR_SETTINGS], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      if (result[STORAGE_KEY_OCR_SETTINGS]) {
        const stored = result[STORAGE_KEY_OCR_SETTINGS] as OcrSettings;
        resolve({
          selectedLanguages: stored.selectedLanguages?.length ? stored.selectedLanguages : DEFAULT_SETTINGS.selectedLanguages,
          batchSize: stored.batchSize || DEFAULT_SETTINGS.batchSize,
        });
        return;
      }
      resolve(DEFAULT_SETTINGS);
    });
  });
}

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

export async function getSelectedLanguages(): Promise<string[]> {
  const settings = await getOcrSettings();
  return settings.selectedLanguages;
}

export async function setSelectedLanguages(languages: string[]): Promise<void> {
  if (languages.length === 0) {
    languages = ['eng'];
  }
  await saveOcrSettings({ selectedLanguages: languages });
}
