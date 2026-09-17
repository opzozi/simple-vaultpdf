import { PDFDocument } from 'pdf-lib';
import type { PageConfig } from './store';
import { applyPageRotation } from './rotation';

export async function savePdf(
  originalFile: File,
  pageModifications: PageConfig[]
): Promise<Uint8Array> {
  const originalPdfBytes = await originalFile.arrayBuffer();
  const originalPdf = await PDFDocument.load(originalPdfBytes, { 
    ignoreEncryption: true,
    parseSpeed: 1,
  });
  
  const newPdf = await PDFDocument.create();
  const originalPages = originalPdf.getPages();
  const activePages = pageModifications.filter((config) => !config.isDeleted);
  
  for (const config of activePages) {
    const originalPageIndex = config.pageNumber - 1;
    if (originalPageIndex < 0 || originalPageIndex >= originalPages.length) {
      console.warn(`Page ${config.pageNumber} not found, skipping`);
      continue;
    }
    
    const [copiedPage] = await newPdf.copyPages(originalPdf, [originalPageIndex]);
    const newPage = newPdf.addPage(copiedPage);
    applyPageRotation(newPage, config);
  }
  
  return newPdf.save();
}

export async function savePdfToFile(
  originalFile: File,
  pageModifications: PageConfig[]
): Promise<void> {
  const pdfBytes = await savePdf(originalFile, pageModifications);
  
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
      if ((error as Error).name === 'AbortError') {
        return;
      }
      console.error('Error using File System Access API:', error);
    }
  }
  
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
