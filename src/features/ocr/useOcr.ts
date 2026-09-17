import { useState, useCallback } from 'react';
import { usePdfStore } from '@/lib/pdf/store';
import { extractNativePageText } from '@/lib/pdf/extractText';
import { getPageCanvas, canvasToBlob, blobToDataURL } from '@/lib/ocr/utils';
import { getOcrSettings } from '@/lib/ocr/storage';

export type ExtractSource = 'native' | 'ocr';

export interface ExtractPageResult {
  pageNumber: number;
  text: string;
  confidence: number;
  source: ExtractSource;
}

export interface ExtractResult {
  text: string;
  confidence: number;
  pageNumber: number;
  nativePages: number;
  ocrPages: number;
}

interface UseOcrOptions {
  forceOcr?: boolean;
}

export function useOcr() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [allPagesResult, setAllPagesResult] = useState<ExtractPageResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { pdfDocument } = usePdfStore();

  const runOcrOnPage = useCallback(async (
    pageNumber: number,
    requestId: string,
    onPageProgress?: (progress: number) => void
  ): Promise<ExtractPageResult> => {
    if (!pdfDocument) {
      throw new Error('No PDF document loaded');
    }

    return new Promise(async (resolve, reject) => {
      try {
        const settings = await getOcrSettings();
        const selectedLanguages = settings.selectedLanguages || ['eng'];

        const { canvas } = await getPageCanvas(pdfDocument, pageNumber, 2.0);
        const blob = await canvasToBlob(canvas);
        const imageData = await blobToDataURL(blob);

        const messageListener = (message: any) => {
          if (message.type === 'OCR_PROGRESS' && message.requestId === requestId) {
            onPageProgress?.(message.progress);
          } else if (message.type === 'OCR_RESPONSE' && message.requestId === requestId) {
            chrome.runtime.onMessage.removeListener(messageListener);
            if (message.success) {
              resolve({
                pageNumber: message.pageNumber,
                text: message.text,
                confidence: message.confidence,
                source: 'ocr',
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

  const processSinglePage = useCallback(async (
    pageNumber: number,
    requestId: string,
    onPageProgress?: (progress: number) => void,
    forceOcr = false
  ): Promise<ExtractPageResult> => {
    if (!pdfDocument) {
      throw new Error('No PDF document loaded');
    }

    if (!forceOcr) {
      const native = await extractNativePageText(pdfDocument, pageNumber);
      if (native.usable) {
        onPageProgress?.(1);
        return {
          pageNumber,
          text: native.text,
          confidence: 100,
          source: 'native',
        };
      }
    }

    return runOcrOnPage(pageNumber, requestId, onPageProgress);
  }, [pdfDocument, runOcrOnPage]);

  const processPages = useCallback(async (pageNumbers: number[], options: UseOcrOptions = {}) => {
    const forceOcr = options.forceOcr === true;

    if (!pdfDocument) {
      setError('No PDF document loaded');
      return;
    }

    if (pageNumbers.length === 0) {
      setError('No pages selected. Please select at least one page.');
      return;
    }

    const settings = await getOcrSettings();
    const batchSize = settings.batchSize || 3;

    setIsProcessing(true);
    setProgress(0);
    setCurrentPage(0);
    setTotalPages(pageNumbers.length);
    setError(null);
    setResult(null);
    setAllPagesResult([]);

    const results: ExtractPageResult[] = [];
    const errors: string[] = [];

    try {
      for (let i = 0; i < pageNumbers.length; i += batchSize) {
        const batch = pageNumbers.slice(i, i + batchSize);
        const batchStartProgress = (i / pageNumbers.length) * 100;
        const batchWeight = (batch.length / pageNumbers.length) * 100;

        const batchPromises = batch.map(async (pageNum, batchIndex) => {
          const requestId = `extract-${Date.now()}-${pageNum}-${batchIndex}`;

          try {
            const pageResult = await Promise.race([
              processSinglePage(pageNum, requestId, (pageProgress) => {
                const pageProgressInBatch = (pageProgress * batchWeight) / batch.length;
                const overallProgress = batchStartProgress + (batchIndex * batchWeight / batch.length) + pageProgressInBatch;
                setProgress(overallProgress);
              }, forceOcr),
              new Promise<ExtractPageResult>((_, reject) =>
                setTimeout(() => reject(new Error(`Page ${pageNum}: Processing timeout after 90 seconds`)), 90000)
              ),
            ]);

            return { success: true as const, result: pageResult, pageNum };
          } catch (pageError) {
            const errorMsg = pageError instanceof Error ? pageError.message : String(pageError);
            return { success: false as const, error: errorMsg, pageNum };
          }
        });

        const batchResults = await Promise.all(batchPromises);

        for (const batchResult of batchResults) {
          if (batchResult.success && batchResult.result) {
            results.push(batchResult.result);
            setAllPagesResult([...results]);
            setCurrentPage(batchResult.pageNum);
          } else {
            errors.push(`Page ${batchResult.pageNum}: ${batchResult.error || 'Unknown error'}`);
          }
        }

        setProgress(((i + batch.length) / pageNumbers.length) * 100);
      }

      if (results.length > 0) {
        const sortedResults = results.sort((a, b) => a.pageNumber - b.pageNumber);
        const successfulPageNumbers = new Set(sortedResults.map((r) => r.pageNumber));
        const failedPages = pageNumbers.filter((p) => !successfulPageNumbers.has(p));

        let combinedText = sortedResults
          .map((r) => {
            const sourceLabel = r.source === 'native' ? 'PDF text' : 'OCR';
            return `--- Page ${r.pageNumber} (${sourceLabel}) ---\n${r.text}`;
          })
          .join('\n\n');

        if (failedPages.length > 0) {
          const errorMessages = failedPages
            .map((p) => {
              const pageError = errors.find((e) => e.includes(`Page ${p}:`));
              const errorText = pageError ? pageError.split(': ').slice(1).join(': ') : 'Extraction failed';
              return `--- Page ${p} ---\n[Error on Page ${p}: ${errorText}]`;
            })
            .join('\n\n');
          combinedText += (combinedText ? '\n\n' : '') + errorMessages;
        }

        const ocrResults = sortedResults.filter((r) => r.source === 'ocr');
        const nativeResults = sortedResults.filter((r) => r.source === 'native');
        const avgConfidence = ocrResults.length > 0
          ? ocrResults.reduce((sum, r) => sum + r.confidence, 0) / ocrResults.length
          : 100;

        setResult({
          text: combinedText,
          confidence: avgConfidence,
          pageNumber: 0,
          nativePages: nativeResults.length,
          ocrPages: ocrResults.length,
        });
      } else {
        setError('All pages failed to process. ' + errors.join('; '));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to extract text';
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
      setProgress(100);
    }
  }, [pdfDocument, processSinglePage]);

  const processAllPages = useCallback(async () => {
    if (!pdfDocument) {
      setError('No PDF document loaded');
      return;
    }

    const pageCount = pdfDocument.numPages;
    const pageNumbers = Array.from({ length: pageCount }, (_, i) => i + 1);
    await processPages(pageNumbers);
  }, [pdfDocument, processPages]);

  const processPage = useCallback(async (pageNumber: number) => {
    await processPages([pageNumber]);
  }, [processPages]);

  const clearResult = useCallback(() => {
    setResult(null);
    setAllPagesResult([]);
    setError(null);
    setProgress(0);
    setCurrentPage(0);
    setTotalPages(0);
    setIsProcessing(false);
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
