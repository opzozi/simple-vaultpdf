import { PDFDocument } from 'pdf-lib';
import type { PageConfig } from '@/lib/pdf/store';

/**
 * Extract selected pages to a new PDF file
 * @param originalFile The original PDF file
 * @param pageConfigs All page configurations
 * @param selectedPageIds Set of page IDs to extract
 * @returns A new PDF File object with only the selected pages
 */
export async function extractPagesToPDF(
  originalFile: File,
  pageConfigs: PageConfig[],
  selectedPageIds: Set<string>
): Promise<File> {
  if (selectedPageIds.size === 0) {
    throw new Error('No pages selected for extraction');
  }

  try {
    // Load the original PDF (ignore encryption if present)
    const originalPdfBytes = await originalFile.arrayBuffer();
    const originalPdf = await PDFDocument.load(originalPdfBytes, { 
      ignoreEncryption: true,
      parseSpeed: 1, // Slower but more robust parsing
    });

    // Create a new PDF document
    const extractedPdf = await PDFDocument.create();

    // Get all pages from original PDF
    const originalPages = originalPdf.getPages();

    // Filter to only selected pages (maintain order from pageConfigs)
    const selectedPages = pageConfigs.filter(
      (config) => selectedPageIds.has(config.id) && !config.isDeleted
    );

    // Copy selected pages in their current order
    for (const config of selectedPages) {
      const originalPageIndex = config.pageNumber - 1;
      if (originalPageIndex < 0 || originalPageIndex >= originalPages.length) {
        console.warn(`Page ${config.pageNumber} not found, skipping`);
        continue;
      }

      // Copy the page
      const [copiedPage] = await extractedPdf.copyPages(originalPdf, [originalPageIndex]);
      const newPage = extractedPdf.addPage(copiedPage);

      // Apply rotation if needed (pdf-lib rotation is in degrees: 0, 90, 180, 270)
      // Normalize rotation to valid pdf-lib values (0, 90, 180, 270)
      const normalizedRotation = ((config.rotation % 360) + 360) % 360; // Handle negative values
      
      // Map to valid pdf-lib rotation values (must be exactly 0, 90, 180, or 270)
      // TypeScript type checking is overly strict here, but runtime values are correct
      if (normalizedRotation >= 0 && normalizedRotation < 45) {
        // No rotation needed (0 degrees)
      } else if (normalizedRotation >= 45 && normalizedRotation < 135) {
        // @ts-expect-error - pdf-lib accepts 90 as valid rotation, TypeScript type is too strict
        newPage.setRotation(90);
      } else if (normalizedRotation >= 135 && normalizedRotation < 225) {
        // @ts-expect-error - pdf-lib accepts 180 as valid rotation, TypeScript type is too strict
        newPage.setRotation(180);
      } else if (normalizedRotation >= 225 && normalizedRotation < 315) {
        // @ts-expect-error - pdf-lib accepts 270 as valid rotation, TypeScript type is too strict
        newPage.setRotation(270);
      }
      // 315-360 range maps to 0, no rotation needed
    }

    // Generate extracted PDF as bytes
    const extractedPdfBytes = await extractedPdf.save();

    // Create a new File object
    const arrayBuffer = extractedPdfBytes.buffer.slice(
      extractedPdfBytes.byteOffset,
      extractedPdfBytes.byteOffset + extractedPdfBytes.byteLength
    ) as ArrayBuffer;

    const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
    const extractedFile = new File([blob], 'Extracted_Pages.pdf', {
      type: 'application/pdf',
      lastModified: Date.now(),
    });

    return extractedFile;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to extract pages';
    throw new Error(`PDF extraction failed: ${errorMessage}`);
  }
}

