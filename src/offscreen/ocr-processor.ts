import { createTesseractWorker } from '@/lib/ocr/tesseractConfig';

let tesseractWorker: any = null;
let workerLanguagesKey = '';

async function getWorker(selectedLanguages?: string[]) {
  const languagesKey = (selectedLanguages && selectedLanguages.length > 0 ? selectedLanguages : ['eng']).join('+');
  if (tesseractWorker && workerLanguagesKey !== languagesKey) {
    await cleanupWorker();
  }

  if (!tesseractWorker) {
    try {
      const languagesToUse = selectedLanguages && selectedLanguages.length > 0
        ? selectedLanguages
        : ['eng'];

      tesseractWorker = await Promise.race([
        createTesseractWorker(languagesToUse),
        new Promise((_, reject) =>
          setTimeout(() => {
            reject(new Error('TESSERACT_INIT_TIMEOUT'));
          }, 120000)
        ),
      ]).catch((error: any) => {
        if (error?.message === 'TESSERACT_INIT_TIMEOUT') {
          throw new Error('Tesseract initialization is taking longer than expected. Please wait a moment and try again.');
        }
        throw error;
      });
      workerLanguagesKey = languagesToUse.join('+');
    } catch (error) {
      console.error('Failed to initialize Tesseract worker:', error);
      throw error;
    }
  }
  return tesseractWorker;
}

export async function processOCR(
  imageData: string | ImageData,
  onProgress?: (progress: number) => void,
  selectedLanguages?: string[]
): Promise<{ text: string; confidence: number }> {
  if (onProgress) {
    onProgress(0.01);
  }

  let worker;
  try {
    worker = await getWorker(selectedLanguages);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Tesseract worker initialization failed: ${errorMessage}`);
  }

  if (onProgress) {
    onProgress(0.15);
  }

  const extractionPromise = worker.recognize(imageData);

  let progressStep = 0.15;
  let progressInterval: ReturnType<typeof setInterval> | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    progressInterval = setInterval(() => {
      if (onProgress && progressStep < 0.95) {
        progressStep = Math.min(progressStep + 0.05, 0.95);
        onProgress(progressStep);
      }
    }, 2000);

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('OCR text extraction timeout after 2 minutes')), 120000);
    });

    const result = await Promise.race([extractionPromise, timeoutPromise]) as any;

    if (progressInterval) clearInterval(progressInterval);
    if (timeoutId) clearTimeout(timeoutId);

    if (onProgress) {
      onProgress(1.0);
    }

    return {
      text: result.data.text || '',
      confidence: result.data.confidence || 0,
    };
  } catch (error) {
    if (progressInterval) clearInterval(progressInterval);
    if (timeoutId) clearTimeout(timeoutId);
    console.error('OCR processing error:', error);
    throw error;
  }
}

export async function cleanupWorker() {
  if (tesseractWorker) {
    await tesseractWorker.terminate();
    tesseractWorker = null;
    workerLanguagesKey = '';
  }
}
