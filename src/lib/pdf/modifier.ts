import { PDFDocument } from 'pdf-lib';
import type { PageConfig } from './store';

/**
 * Save a modified PDF with reordered, rotated, and deleted pages
 */
export async function savePdf(
  originalFile: File,
  pageModifications: PageConfig[]
): Promise<Uint8Array> {
  // Load the original PDF (ignore encryption if present)
  const originalPdfBytes = await originalFile.arrayBuffer();
  const originalPdf = await PDFDocument.load(originalPdfBytes, { 
    ignoreEncryption: true,
    parseSpeed: 1, // Slower but more robust parsing
  });
  
  // Create a new PDF document
  const newPdf = await PDFDocument.create();
  
  // Get all pages from original PDF
  const originalPages = originalPdf.getPages();
  
  // Filter out deleted pages - maintain the order from pageModifications array
  // The array order already reflects the user's reordering via drag-and-drop
  const activePages = pageModifications.filter((config) => !config.isDeleted);
  
  // Copy pages from original to new PDF in the specified order
  for (const config of activePages) {
    // Get the original page (pageNumber is 1-indexed)
    const originalPageIndex = config.pageNumber - 1;
    if (originalPageIndex < 0 || originalPageIndex >= originalPages.length) {
      console.warn(`Page ${config.pageNumber} not found, skipping`);
      continue;
    }
    
    // Copy the page
    const [copiedPage] = await newPdf.copyPages(originalPdf, [originalPageIndex]);
    
    // Add the page to the new PDF first
    const newPage = newPdf.addPage(copiedPage);
    
    // Apply rotation after adding (pdf-lib rotation is in degrees: 0, 90, 180, 270)
    if (config.rotation !== 0) {
      // Normalize rotation to valid pdf-lib values
      const normalizedRotation = config.rotation % 360;
      if (normalizedRotation === 90) {
        newPage.setRotation(90 as any);
      } else if (normalizedRotation === 180) {
        newPage.setRotation(180 as any);
      } else if (normalizedRotation === 270) {
        newPage.setRotation(270 as any);
      }
      // 0 rotation doesn't need to be set
    }
  }
  
  // Generate and return the PDF as bytes
  const pdfBytes = await newPdf.save();
  return pdfBytes;
}

/**
 * Save PDF using File System Access API if available, otherwise download
 */
export async function savePdfToFile(
  originalFile: File,
  pageModifications: PageConfig[]
): Promise<void> {
  const pdfBytes = await savePdf(originalFile, pageModifications);
  
  // Try to use File System Access API
  if ('showSaveFilePicker' in window) {
    try {
      const fileHandle = await (window as any).showSaveFilePicker({
        suggestedName: originalFile.name.replace('.pdf', '_modified.pdf'),
        types: [
          {
            description: 'PDF Files',
            accept: { 'application/pdf': ['.pdf'] },
          },
        ],
      });
      
      const writable = await fileHandle.createWritable();
      await writable.write(pdfBytes);
      await writable.close();
      return;
    } catch (error) {
      // User cancelled or error occurred, fall back to download
      if ((error as Error).name !== 'AbortError') {
        console.error('Error using File System Access API:', error);
      }
    }
  }
  
  // Fallback to download
  // Convert Uint8Array to ArrayBuffer for Blob constructor
  const arrayBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = originalFile.name.replace('.pdf', '_modified.pdf');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

