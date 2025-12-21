/**
 * Export PDF page canvas as image
 */

import type { PDFDocumentProxy } from 'pdfjs-dist';

export type ImageFormat = 'png' | 'jpg';

/**
 * Render a PDF page to a high-resolution canvas for export
 * @param pdfDocument - The PDF document
 * @param pageNumber - The page number to render
 * @param scale - The scale factor for rendering (higher = better quality, larger file)
 * @returns A canvas element with the rendered page
 */
export async function renderPageToHighResCanvas(
  pdfDocument: PDFDocumentProxy,
  pageNumber: number,
  scale: number = 3.0
): Promise<HTMLCanvasElement> {
  const page = await pdfDocument.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  
  // Create a temporary canvas with high resolution
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to get canvas context');
  }
  
  // Render PDF page into canvas context
  const renderContext = {
    canvasContext: context,
    viewport: viewport,
  };
  
  await page.render(renderContext).promise;
  
  return canvas;
}

/**
 * Save a canvas element as an image file
 * @param canvas - The canvas element to export
 * @param pageNumber - The page number (for filename)
 * @param format - Image format ('png' or 'jpg')
 * @param quality - Quality for JPEG (0.0 to 1.0, only used for JPG)
 */
export function saveCanvasAsImage(
  canvas: HTMLCanvasElement,
  pageNumber: number,
  format: ImageFormat = 'png',
  quality: number = 0.95
): void {
  try {
    const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
    const extension = format === 'jpg' ? 'jpg' : 'png';
    
    // Get canvas data URL
    // PNG: no quality parameter (lossless, quality is ignored)
    // JPG: use quality parameter (0.0 to 1.0)
    const dataUrl = format === 'jpg' 
      ? canvas.toDataURL(mimeType, quality)
      : canvas.toDataURL(mimeType);
    
    // Create a temporary link element
    const link = document.createElement('a');
    link.download = `page-${pageNumber}.${extension}`;
    link.href = dataUrl;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Error saving canvas as image:', error);
    throw new Error('Failed to save image. Please try again.');
  }
}

/**
 * Find the currently visible page canvas in the viewport
 * @param pageCanvases - Array of canvas elements (one per page)
 * @returns The canvas element of the first visible page with its page number, or null if none found
 */
export function findVisiblePageCanvas(pageCanvases: HTMLCanvasElement[]): { canvas: HTMLCanvasElement; pageNumber: number } | null {
  const viewportTop = window.scrollY || window.pageYOffset;
  const viewportBottom = viewportTop + window.innerHeight;
  
  // Find the first canvas that is visible in the viewport
  for (const canvas of pageCanvases) {
    const rect = canvas.getBoundingClientRect();
    const canvasTop = rect.top + viewportTop;
    const canvasBottom = canvasTop + rect.height;
    
    // Check if canvas is visible in viewport (at least 50% visible)
    const visibleHeight = Math.min(canvasBottom, viewportBottom) - Math.max(canvasTop, viewportTop);
    if (visibleHeight > rect.height * 0.5) {
      // Try to get page number from data attribute
      const pageNumberAttr = canvas.getAttribute('data-page-number');
      const pageNumber = pageNumberAttr ? parseInt(pageNumberAttr, 10) : 1;
      
      return { canvas, pageNumber };
    }
  }
  
  // If no canvas is visible, return the first one
  if (pageCanvases.length > 0) {
    const firstCanvas = pageCanvases[0];
    const pageNumberAttr = firstCanvas.getAttribute('data-page-number');
    const pageNumber = pageNumberAttr ? parseInt(pageNumberAttr, 10) : 1;
    return { canvas: firstCanvas, pageNumber };
  }
  
  return null;
}

/**
 * Get all page canvas elements from the DOM
 * @returns Array of canvas elements
 */
export function getAllPageCanvases(): HTMLCanvasElement[] {
  // Find all canvas elements that are PDF pages
  // They should be inside the PDF viewer container
  const canvases = Array.from(document.querySelectorAll('canvas')) as HTMLCanvasElement[];
  
  // Filter to only include canvases that are actually rendered (have content)
  return canvases.filter(canvas => {
    // Check if canvas has been rendered (has non-zero dimensions)
    return canvas.width > 0 && canvas.height > 0;
  });
}

