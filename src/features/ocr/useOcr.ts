import { useState, useCallback } from 'react';
import { usePdfStore } from '@/lib/pdf/store';
import { getPageCanvas, canvasToBlob, blobToDataURL } from '@/lib/ocr/utils';
import { getOcrSettings } from '@/lib/ocr/storage';

interface OcrResult {
  text: string;
  confidence: number;
  pageNumber: number;
}

interface OcrPageResult {
  pageNumber: number;
  text: string;
  confidence: number;
}

export function useOcr() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [allPagesResult, setAllPagesResult] = useState<OcrPageResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { pdfDocument } = usePdfStore();

  // Process a single page
  const processSinglePage = useCallback(async (
    pageNumber: number, 
    requestId: string,
    onPageProgress?: (progress: number) => void
  ): Promise<OcrPageResult> => {
    if (!pdfDocument) {
      throw new Error('No PDF document loaded');
    }

    return new Promise(async (resolve, reject) => {
      try {
        // Get selected languages
        const settings = await getOcrSettings();
        const selectedLanguages = settings.selectedLanguages || ['eng'];
        
        // Convert PDF page to canvas
        const { canvas } = await getPageCanvas(pdfDocument, pageNumber, 2.0);
        const blob = await canvasToBlob(canvas);
        const imageData = await blobToDataURL(blob);
        
        // Set up message listener for this page
        const messageListener = (message: any) => {
          if (message.type === 'OCR_PROGRESS' && message.requestId === requestId) {
            // Update progress for this specific page (0-1 range)
            if (onPageProgress) {
              onPageProgress(message.progress);
            }
          } else if (message.type === 'OCR_RESPONSE' && message.requestId === requestId) {
            chrome.runtime.onMessage.removeListener(messageListener);
            if (message.success) {
              resolve({
                pageNumber: message.pageNumber,
                text: message.text,
                confidence: message.confidence,
              });
            } else {
              reject(new Error(message.error || 'OCR processing failed'));
            }
          } else if (message.type === 'OCR_ERROR' && message.requestId === requestId) {
            chrome.runtime.onMessage.removeListener(messageListener);
            reject(new Error(message.error || 'OCR processing failed'));
          }
        };

        chrome.runtime.onMessage.addListener(messageListener);

        // Send OCR request with selected languages
        chrome.runtime.sendMessage({
          type: 'OCR_REQUEST',
          imageData,
          pageNumber,
          requestId,
          selectedLanguages,
        }).catch((err) => {
          chrome.runtime.onMessage.removeListener(messageListener);
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }, [pdfDocument]);

  // Process selected pages of the PDF
  const processPages = useCallback(async (pageNumbers: number[]) => {
    console.log('processPages called with:', pageNumbers);
    
    if (!pdfDocument) {
      const errorMsg = 'No PDF document loaded';
      console.error(errorMsg);
      setError(errorMsg);
      return;
    }

    if (pageNumbers.length === 0) {
      const errorMsg = 'No pages selected. Please select at least one page for OCR processing.';
      console.error(errorMsg);
      setError(errorMsg);
      return;
    }

    console.log('Getting OCR settings...');
    const settings = await getOcrSettings();
    const batchSize = settings.batchSize || 3; // Default to 3 pages in parallel
    console.log('Batch size:', batchSize, 'Pages to process:', pageNumbers.length);

    setIsProcessing(true);
    setProgress(0);
    setCurrentPage(0);
    setTotalPages(pageNumbers.length);
    setError(null);
    setResult(null);
    setAllPagesResult([]);

    const results: OcrPageResult[] = [];
    const errors: string[] = [];

    try {
      // Process pages in batches to improve performance
      for (let i = 0; i < pageNumbers.length; i += batchSize) {
        const batch = pageNumbers.slice(i, i + batchSize);
        const batchStartProgress = (i / pageNumbers.length) * 100;
        const batchWeight = (batch.length / pageNumbers.length) * 100;

        // Process batch in parallel
        const batchPromises = batch.map(async (pageNum, batchIndex) => {
          const requestId = `ocr-${Date.now()}-${pageNum}-${batchIndex}`;
          
          try {
            const pageResult = await Promise.race([
              processSinglePage(pageNum, requestId, (pageProgress) => {
                // Update progress for this page within the batch
                const pageProgressInBatch = (pageProgress * batchWeight) / batch.length;
                const overallProgress = batchStartProgress + (batchIndex * batchWeight / batch.length) + pageProgressInBatch;
                setProgress(overallProgress);
              }),
              new Promise<OcrPageResult>((_, reject) =>
                setTimeout(() => reject(new Error(`Page ${pageNum}: Processing timeout after 90 seconds`)), 90000)
              ),
            ]);

            return { success: true, result: pageResult, pageNum };
          } catch (pageError) {
            const errorMsg = pageError instanceof Error ? pageError.message : String(pageError);
            return { success: false, error: errorMsg, pageNum };
          }
        });

        // Wait for all pages in batch to complete
        const batchResults = await Promise.all(batchPromises);

        // Process batch results
        for (const batchResult of batchResults) {
          if (batchResult.success && batchResult.result) {
            results.push(batchResult.result);
            setAllPagesResult([...results]);
            setCurrentPage(batchResult.pageNum);
          } else {
            errors.push(`Page ${batchResult.pageNum}: ${batchResult.error || 'Unknown error'}`);
            console.error(`OCR failed for page ${batchResult.pageNum}:`, batchResult.error);
          }
        }

        // Update progress after batch
        const batchEndProgress = ((i + batch.length) / pageNumbers.length) * 100;
        setProgress(batchEndProgress);
      }

      // Combine all results
      if (results.length > 0) {
        // Sort results by page number
        const sortedResults = results.sort((a, b) => a.pageNumber - b.pageNumber);
        
        // Find which pages were successfully processed
        const successfulPageNumbers = new Set(sortedResults.map(r => r.pageNumber));
        
        // Find failed pages by comparing with requested pages
        const failedPages = pageNumbers.filter(p => !successfulPageNumbers.has(p));
        
        // Build combined text with successful results
        let combinedText = sortedResults
          .map((r) => `--- Page ${r.pageNumber} ---\n${r.text}`)
          .join('\n\n');
        
        // Add error messages for failed pages (don't crash, just append error info)
        if (failedPages.length > 0) {
          const errorMessages = failedPages
            .map(p => {
              const error = errors.find(e => e.includes(`Page ${p}:`));
              const errorText = error ? error.split(': ').slice(1).join(': ') : 'OCR processing failed';
              return `--- Page ${p} ---\n[Error on Page ${p}: ${errorText}]`;
            })
            .join('\n\n');
          combinedText += (combinedText ? '\n\n' : '') + errorMessages;
        }

        const avgConfidence = sortedResults.reduce((sum, r) => sum + r.confidence, 0) / sortedResults.length;

        setResult({
          text: combinedText,
          confidence: avgConfidence,
          pageNumber: 0, // 0 means multiple pages
        });

        // Show warning if some pages failed, but don't treat it as a critical error
        if (errors.length > 0) {
          const warningMessage = `${errors.length} page(s) failed to process. Check the result for error messages.`;
          console.warn('OCR warnings:', warningMessage);
          // Don't set as error, just log - the result still contains what was successfully processed
        }
      } else {
        // All pages failed - this is a real error
        setError('All pages failed to process. ' + errors.join('; '));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process OCR';
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
      setProgress(100);
    }
  }, [pdfDocument, processSinglePage]);

  // Process all pages
  const processAllPages = useCallback(async () => {
    if (!pdfDocument) {
      setError('No PDF document loaded');
      return;
    }

    const totalPages = pdfDocument.numPages;
    const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);
    await processPages(pageNumbers);
  }, [pdfDocument, processPages]);

  // Legacy single page processing (kept for compatibility)
  const processPage = useCallback(async (pageNumber: number) => {
    await processPages([pageNumber]);
  }, [processPages]);

  const clearResult = useCallback(() => {
    console.log('[OCR] Clearing result and resetting state');
    setResult(null);
    setAllPagesResult([]);
    setError(null);
    setProgress(0);
    setCurrentPage(0);
    setTotalPages(0);
    setIsProcessing(false); // Ensure processing flag is also cleared
  }, []);

  return {
    processPage,
    processPages,
    processAllPages,
    isProcessing,
    progress,
    currentPage,
    totalPages,
    result,
    allPagesResult,
    error,
    clearResult,
  };
}

