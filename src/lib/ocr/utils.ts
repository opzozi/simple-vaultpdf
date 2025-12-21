/**
 * Utility functions for OCR processing
 */

/**
 * Convert PDF page canvas to image blob
 * @param canvas The canvas element
 * @param format Image format ('image/jpeg' for smaller size, 'image/png' for quality)
 * @param quality JPEG quality (0.0-1.0), only used for JPEG format
 */
export async function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: 'image/jpeg' | 'image/png' = 'image/jpeg',
  quality: number = 0.85
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      },
      format,
      format === 'image/jpeg' ? quality : undefined
    );
  });
}

/**
 * Convert blob to base64 data URL
 */
export async function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to data URL'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Get canvas from PDF page
 * @param pdfDocument The PDF document
 * @param pageNumber The page number (1-indexed)
 * @param scale The scale factor for rendering (higher = better quality, larger file)
 * @returns The rendered canvas and the original page dimensions
 */
export async function getPageCanvas(
  pdfDocument: any,
  pageNumber: number,
  scale: number = 2.0
): Promise<{ canvas: HTMLCanvasElement; originalWidth: number; originalHeight: number }> {
  const page = await pdfDocument.getPage(pageNumber);
  
  // Get original page dimensions (scale = 1.0)
  const originalViewport = page.getViewport({ scale: 1.0 });
  const originalWidth = originalViewport.width;
  const originalHeight = originalViewport.height;
  
  // Get viewport for rendering (higher scale for better quality)
  const renderViewport = page.getViewport({ scale });
  
  const canvas = document.createElement('canvas');
  canvas.width = renderViewport.width;
  canvas.height = renderViewport.height;
  
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to get canvas context');
  }
  
  const renderContext = {
    canvasContext: context,
    viewport: renderViewport,
  };
  
  await page.render(renderContext).promise;
  
  return { canvas, originalWidth, originalHeight };
}

