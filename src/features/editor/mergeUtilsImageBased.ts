import { PDFDocument } from 'pdf-lib';
import { pdfjsLib } from '@/lib/pdf/init';
import { getPageCanvas, canvasToBlob } from '@/lib/ocr/utils';

/**
 * Alternative merge approach: Use pdfjs-dist to render pages as images,
 * then embed those images into a new PDF using pdf-lib.
 * This works even when pdf-lib cannot directly load the PDF files.
 */
export async function mergePDFsImageBased(
  currentFile: File,
  newFiles: File[]
): Promise<File> {
  if (newFiles.length === 0) {
    return currentFile;
  }

  const skippedFiles: string[] = [];
  let hasProcessedAnyFile = false;

  try {
    // Step 1: Load current PDF with pdf-lib (try direct load first)
    let currentPdf;
    let useImageBasedForCurrent = false;
    
    try {
      const currentPdfBytes = await currentFile.arrayBuffer();
      currentPdf = await PDFDocument.load(currentPdfBytes, { 
        ignoreEncryption: true,
        parseSpeed: 1,
      });
    } catch (error) {
      // If pdf-lib can't load it, we'll use image-based approach for current file too
      console.warn('[PDF Merge] Current PDF cannot be loaded with pdf-lib, using image-based approach');
      useImageBasedForCurrent = true;
    }

    // Create a new PDF document
    const mergedPdf = await PDFDocument.create();

    // Step 2: Add pages from current PDF
    if (!useImageBasedForCurrent && currentPdf) {
      // Direct copy from pdf-lib
      try {
        const currentPages = currentPdf.getPages();
        const currentPageIndices = currentPages.map((_, i) => i);
        const copiedCurrentPages = await mergedPdf.copyPages(currentPdf, currentPageIndices);
        copiedCurrentPages.forEach((page) => {
          if (page) {
            mergedPdf.addPage(page);
          }
        });
      } catch (error) {
        console.warn('[PDF Merge] Failed to copy current PDF pages directly, using image-based approach');
        useImageBasedForCurrent = true;
      }
    }

    if (useImageBasedForCurrent) {
      // Render current PDF pages as images
      const currentPdfBytes = await currentFile.arrayBuffer();
      const currentPdfDoc = await pdfjsLib.getDocument({ data: currentPdfBytes }).promise;
      const currentNumPages = currentPdfDoc.numPages;

      for (let pageNum = 1; pageNum <= currentNumPages; pageNum++) {
        try {
          // Use 2.0x scale for good quality, but use original page dimensions
          const { canvas, originalWidth, originalHeight } = await getPageCanvas(currentPdfDoc, pageNum, 2.0);
          // Use JPEG with 0.9 quality for better quality while keeping file size reasonable
          const imageBlob = await canvasToBlob(canvas, 'image/jpeg', 0.9);
          const imageBytes = await imageBlob.arrayBuffer();
          const image = await mergedPdf.embedJpg(imageBytes);
          
          // Use original page dimensions, not canvas dimensions
          const page = mergedPdf.addPage([originalWidth, originalHeight]);
          // Draw image at original size (scale down from high-res canvas)
          page.drawImage(image, {
            x: 0,
            y: 0,
            width: originalWidth,
            height: originalHeight,
          });
        } catch (error) {
          console.error(`[PDF Merge] Failed to render current PDF page ${pageNum}:`, error);
        }
      }
    }

    // Step 3: Process each new file
    for (let i = 0; i < newFiles.length; i++) {
      const newFile = newFiles[i];
      
      if (!newFile || newFile.size === 0) {
        skippedFiles.push(`${newFile?.name || `File ${i + 1}`}: File is empty or invalid`);
        continue;
      }

      try {
        // Try pdf-lib first (faster, better quality)
        let newPdf;
        let useImageBased = false;
        
        try {
          const newPdfBytes = await newFile.arrayBuffer();
          newPdf = await PDFDocument.load(newPdfBytes, { 
            ignoreEncryption: true,
            parseSpeed: 1,
          });
        } catch (loadError) {
          // pdf-lib can't load it, use image-based approach
          console.warn(`[PDF Merge] File ${i + 1} (${newFile.name}) cannot be loaded with pdf-lib, using image-based approach`);
          useImageBased = true;
        }

        if (!useImageBased && newPdf) {
          // Direct copy from pdf-lib
          try {
            const newPages = newPdf.getPages();
            const newPageIndices = newPages.map((_, idx) => idx);
            const copiedNewPages = await mergedPdf.copyPages(newPdf, newPageIndices);
            
            copiedNewPages.forEach((page) => {
              if (page) {
                mergedPdf.addPage(page);
                hasProcessedAnyFile = true;
              }
            });
            continue; // Success, move to next file
          } catch (copyError) {
            // Silently switch to image-based - this is expected
            useImageBased = true;
          }
        }

        if (useImageBased) {
          // Render PDF pages as images using pdfjs-dist
          try {
            const newPdfBytes = await newFile.arrayBuffer();
            let newPdfDoc;
            try {
              newPdfDoc = await pdfjsLib.getDocument({ data: newPdfBytes }).promise;
            } catch (pdfjsError) {
              const pdfjsErrorMsg = pdfjsError instanceof Error ? pdfjsError.message : String(pdfjsError);
              skippedFiles.push(`${newFile.name}: Failed to load with pdfjs-dist: ${pdfjsErrorMsg}`);
              // Silently skip - pdfjs-dist couldn't load the file
              continue;
            }

            const numPages = newPdfDoc.numPages;

            if (numPages === 0) {
              skippedFiles.push(`${newFile.name}: PDF has no pages`);
              continue;
            }

            let pagesAdded = 0;
            for (let pageNum = 1; pageNum <= numPages; pageNum++) {
              try {
                // Use 2.0x scale for good quality, but use original page dimensions
                const { canvas, originalWidth, originalHeight } = await getPageCanvas(newPdfDoc, pageNum, 2.0);
                
                // Use JPEG with 0.9 quality for better quality while keeping file size reasonable
                const imageBlob = await canvasToBlob(canvas, 'image/jpeg', 0.9);
                const imageBytes = await imageBlob.arrayBuffer();
                
                // Embed JPEG image in PDF
                const image = await mergedPdf.embedJpg(imageBytes);
                
                // Use original page dimensions, not canvas dimensions
                const page = mergedPdf.addPage([originalWidth, originalHeight]);
                // Draw image at original size (scale down from high-res canvas)
                page.drawImage(image, {
                  x: 0,
                  y: 0,
                  width: originalWidth,
                  height: originalHeight,
                });
                
                pagesAdded++;
                hasProcessedAnyFile = true;
              } catch (pageError) {
                // Silently skip this page - continue with next
              }
            }

            if (pagesAdded === 0) {
              skippedFiles.push(`${newFile.name}: No pages could be rendered`);
            } else {
              console.log(`[PDF Merge] Added ${pagesAdded}/${numPages} page(s) from ${newFile.name} using image-based method`);
            }
          } catch (imageBasedError) {
            const errorMsg = imageBasedError instanceof Error ? imageBasedError.message : String(imageBasedError);
            skippedFiles.push(`${newFile.name}: Image-based processing failed: ${errorMsg}`);
            // Silently skip - image-based processing failed for this file
            continue;
          }
        }
      } catch (fileError) {
        const errorMsg = fileError instanceof Error ? fileError.message : 'Unknown error';
        skippedFiles.push(`${newFile.name}: ${errorMsg}`);
        // Silently skip - error processing this file
        continue;
      }
    }

    // Check if we have any pages
    const mergedPages = mergedPdf.getPageCount();
    if (mergedPages === 0) {
      const errorMsg = skippedFiles.length > 0
        ? `No pages could be merged. All ${newFiles.length} file(s) were skipped:\n\n${skippedFiles.map(f => `  • ${f}`).join('\n')}`
        : 'No pages could be merged. All files may be corrupted or invalid.';
      throw new Error(errorMsg);
    }

    if (!hasProcessedAnyFile && !useImageBasedForCurrent) {
      // This shouldn't happen if mergedPages > 0, but check anyway
      throw new Error('No new pages were added to the merged PDF');
    }

    // Generate merged PDF
    const mergedPdfBytes = await mergedPdf.save();

    // Create File object
    const arrayBuffer = mergedPdfBytes.buffer.slice(
      mergedPdfBytes.byteOffset,
      mergedPdfBytes.byteOffset + mergedPdfBytes.byteLength
    ) as ArrayBuffer;
    
    const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
    const mergedFile = new File([blob], 'Merged_Document.pdf', {
      type: 'application/pdf',
      lastModified: Date.now(),
    });

    // Silently continue - skipped files are tracked but not logged

    return mergedFile;
  } catch (error) {
    let errorMessage = 'Failed to merge PDFs';
    if (error instanceof Error) {
      errorMessage = error.message;
      // Log detailed error information
      // Log only the message, not the full object
      console.log(`[PDF Merge] Image-based merge failed: ${error.message}`);
    } else {
      console.log(`[PDF Merge] Image-based merge failed: ${String(error)}`);
    }
    throw new Error(`PDF merge failed: ${errorMessage}`);
  }
}

