// PDF.js wrappers and utilities
export { pdfjsLib } from './init';
export { usePdfStore } from './store';
export { extractNativePageText, isUsableTextLayer } from './extractText';

import { pdfjsLib } from './init';
import { usePdfStore } from './store';
import type { PDFDocumentProxy } from 'pdfjs-dist';

/**
 * Load a PDF file and return the PDFDocumentProxy
 */
export const loadPDF = async (file: File): Promise<PDFDocumentProxy> => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDocument = await loadingTask.promise;
  return pdfDocument;
};

/**
 * Load PDF and update store
 */
export const loadPDFIntoStore = async (file: File) => {
  const { setLoading, setError, setPdfDocument, setFile, setTotalPages } = usePdfStore.getState();
  
  try {
    setLoading(true);
    setError(null);
    
    const pdfDocument = await loadPDF(file);
    const numPages = pdfDocument.numPages;
    
    setPdfDocument(pdfDocument);
    setFile(file);
    setTotalPages(numPages);
    setLoading(false);
    
    // Initialize pages array for editor
    const { initializePages } = usePdfStore.getState();
    initializePages(numPages);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load PDF';
    setError(errorMessage);
    setLoading(false);
    throw error;
  }
};
