import type { PDFDocumentProxy } from 'pdfjs-dist';

export type ImageFormat = 'png' | 'jpg';

export async function renderPageToHighResCanvas(
  pdfDocument: PDFDocumentProxy,
  pageNumber: number,
  scale: number = 3.0
): Promise<HTMLCanvasElement> {
  const page = await pdfDocument.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to get canvas context');
  }

  await page.render({
    canvasContext: context,
    viewport: viewport,
  }).promise;

  return canvas;
}

export function saveCanvasAsImage(
  canvas: HTMLCanvasElement,
  pageNumber: number,
  format: ImageFormat = 'png',
  quality: number = 0.95
): void {
  try {
    const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
    const extension = format === 'jpg' ? 'jpg' : 'png';
    const dataUrl = format === 'jpg'
      ? canvas.toDataURL(mimeType, quality)
      : canvas.toDataURL(mimeType);

    const link = document.createElement('a');
    link.download = `page-${pageNumber}.${extension}`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Error saving canvas as image:', error);
    throw new Error('Failed to save image. Please try again.');
  }
}
