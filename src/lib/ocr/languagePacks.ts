const DB_NAME = 'vaultpdf-ocr';
const STORE_NAME = 'languages';
const TESS_CACHE_DB = 'keyval-store';
const TESS_CACHE_STORE = 'keyval';

export const BUNDLED_OCR_LANGUAGES = ['eng', 'hun'] as const;
export const TESSDATA_FAST_BASE =
  'https://cdn.jsdelivr.net/gh/tesseract-ocr/tessdata_fast@main';

export function isBundledLanguage(code: string): boolean {
  return (BUNDLED_OCR_LANGUAGES as readonly string[]).includes(code);
}

export function tessdataFastUrl(code: string): string {
  return `${TESSDATA_FAST_BASE}/${code}.traineddata`;
}

function openDb(name: string, storeName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet(name: string, storeName: string, key: string): Promise<Uint8Array | undefined> {
  const db = await openDb(name, storeName);
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).get(key);
      request.onsuccess = () => {
        const value = request.result;
        if (!value) {
          resolve(undefined);
          return;
        }
        if (value instanceof Uint8Array) {
          resolve(value);
          return;
        }
        if (value instanceof ArrayBuffer) {
          resolve(new Uint8Array(value));
          return;
        }
        resolve(undefined);
      };
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function idbSet(name: string, storeName: string, key: string, value: Uint8Array): Promise<void> {
  const db = await openDb(name, storeName);
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function idbDelete(name: string, storeName: string, key: string): Promise<void> {
  const db = await openDb(name, storeName);
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function idbKeys(name: string, storeName: string): Promise<string[]> {
  const db = await openDb(name, storeName);
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).getAllKeys();
      request.onsuccess = () => resolve((request.result as IDBValidKey[]).map(String));
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

function tessCacheKey(code: string): string {
  return `./${code}.traineddata`;
}

export async function saveDownloadedLanguage(code: string, data: Uint8Array): Promise<void> {
  await idbSet(DB_NAME, STORE_NAME, code, data);
  await idbSet(TESS_CACHE_DB, TESS_CACHE_STORE, tessCacheKey(code), data);
}

export async function getDownloadedLanguage(code: string): Promise<Uint8Array | undefined> {
  return idbGet(DB_NAME, STORE_NAME, code);
}

export async function listDownloadedLanguages(): Promise<string[]> {
  try {
    return await idbKeys(DB_NAME, STORE_NAME);
  } catch {
    return [];
  }
}

export async function deleteDownloadedLanguage(code: string): Promise<void> {
  if (isBundledLanguage(code)) {
    throw new Error('Bundled languages cannot be deleted');
  }
  await idbDelete(DB_NAME, STORE_NAME, code);
  await idbDelete(TESS_CACHE_DB, TESS_CACHE_STORE, tessCacheKey(code));
}

export async function clearBundledTesseractCache(): Promise<void> {
  for (const code of BUNDLED_OCR_LANGUAGES) {
    await idbDelete(TESS_CACHE_DB, TESS_CACHE_STORE, tessCacheKey(code));
  }
}

export async function seedTesseractCache(codes: string[]): Promise<void> {
  for (const code of codes) {
    if (isBundledLanguage(code)) continue;
    const data = await getDownloadedLanguage(code);
    if (data) {
      await idbSet(TESS_CACHE_DB, TESS_CACHE_STORE, tessCacheKey(code), data);
    }
  }
}

export async function getAvailableLanguageCodes(): Promise<string[]> {
  const downloaded = await listDownloadedLanguages();
  return Array.from(new Set([...BUNDLED_OCR_LANGUAGES, ...downloaded]));
}

export async function downloadLanguagePack(code: string, onProgress?: (percent: number) => void): Promise<void> {
  const response = await fetch(tessdataFastUrl(code));
  if (!response.ok) {
    throw new Error(`Failed to download ${code}: ${response.status} ${response.statusText}`);
  }

  const contentLength = Number(response.headers.get('content-length') || '0');
  if (!response.body || !contentLength) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    onProgress?.(100);
    await saveDownloadedLanguage(code, buffer);
    return;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      onProgress?.(Math.min(99, Math.round((received / contentLength) * 100)));
    }
  }

  const data = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }
  onProgress?.(100);
  await saveDownloadedLanguage(code, data);
}
