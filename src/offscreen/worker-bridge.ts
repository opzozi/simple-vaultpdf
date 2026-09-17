import { processOCR } from './ocr-processor';

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'OCR_PROCESS') {
    handleOCRRequest(message);
    return false;
  }

  return false;
});

async function handleOCRRequest(message: any) {
  const { imageData, pageNumber, requestId, selectedLanguages } = message;
  const currentRequestId = requestId;

  const sendProgress = (progress: number) => {
    chrome.runtime.sendMessage({
      type: 'OCR_PROGRESS',
      progress,
      requestId: currentRequestId,
      pageNumber,
    }).catch(() => {});
  };

  try {
    sendProgress(0.01);

    const ocrPromise = processOCR(imageData, sendProgress, selectedLanguages || ['eng']);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('OCR processing timeout after 2 minutes')), 120000)
    );

    const result = await Promise.race([ocrPromise, timeoutPromise]) as any;

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
