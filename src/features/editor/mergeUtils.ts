import { PDFDocument } from 'pdf-lib';
import { mergePDFsImageBased } from './mergeUtilsImageBased';

/**
 * Merge multiple PDF files into one
 * @param currentFile The currently loaded PDF file
 * @param newFiles Array of PDF files to merge (will be appended to currentFile)
 * @returns A new merged PDF File object
 */
export interface MergeResult {
  success: boolean;
  file?: File;
  skippedFiles: string[];
  error?: string;
}

export async function mergePDFs(
  currentFile: File,
  newFiles: File[]
): Promise<File> {
  if (newFiles.length === 0) {
    return currentFile;
  }

  const skippedFiles: string[] = [];
  let hasProcessedAnyFile = false;

  try {
    // Validate current file
    if (!currentFile || currentFile.size === 0) {
      throw new Error('Current PDF file is empty or invalid');
    }

    // Load the current PDF (ignore encryption if present)
    const currentPdfBytes = await currentFile.arrayBuffer();
    if (!currentPdfBytes || currentPdfBytes.byteLength === 0) {
      throw new Error('Failed to read current PDF file');
    }

    let currentPdf;
    try {
      currentPdf = await PDFDocument.load(currentPdfBytes, { 
        ignoreEncryption: true,
        parseSpeed: 1, // Slower but more robust parsing
      });
    } catch (loadError) {
      const errorMsg = loadError instanceof Error ? loadError.message : 'Unknown error';
      const userFriendlyMsg = errorMsg.includes('encrypted') 
        ? 'Current PDF is encrypted and cannot be processed. Please unlock it first.'
        : errorMsg.includes('invalid') || errorMsg.includes('parse')
        ? 'Current PDF is corrupted or has an invalid structure.'
        : errorMsg.includes('undefined')
        ? 'Current PDF structure is invalid or unsupported.'
        : `Failed to load: ${errorMsg}`;
      throw new Error(userFriendlyMsg);
    }

    if (!currentPdf) {
      throw new Error('Current PDF loaded but is null/undefined');
    }

    // Create a new PDF document (we'll copy pages into this)
    const mergedPdf = await PDFDocument.create();

    // Copy all pages from current PDF
    try {
      const currentPages = currentPdf.getPages();
      if (!currentPages || currentPages.length === 0) {
        throw new Error('Current PDF has no pages');
      }
      
      const currentPageIndices = currentPages.map((_, i) => i);
      const copiedCurrentPages = await mergedPdf.copyPages(currentPdf, currentPageIndices);
      
      if (!copiedCurrentPages || copiedCurrentPages.length === 0) {
        throw new Error('Failed to copy pages from current PDF');
      }
      
      copiedCurrentPages.forEach((page) => {
        if (page) {
          mergedPdf.addPage(page);
        }
      });
    } catch (copyError) {
      const errorMsg = copyError instanceof Error ? copyError.message : 'Unknown error';
      throw new Error(`Failed to copy pages from current PDF: ${errorMsg}`);
    }

    // Process each new file and append its pages
    for (let i = 0; i < newFiles.length; i++) {
      const newFile = newFiles[i];
      
      // Validate new file
      if (!newFile || newFile.size === 0) {
        skippedFiles.push(`${newFile?.name || `File ${i + 1}`}: File is empty or invalid`);
        console.warn(`Skipping file ${i + 1}: file is empty or invalid`);
        continue;
      }

      try {
        const newPdfBytes = await newFile.arrayBuffer();
        if (!newPdfBytes || newPdfBytes.byteLength === 0) {
          skippedFiles.push(`${newFile.name}: Failed to read file`);
          console.warn(`Skipping file ${i + 1}: failed to read file`);
          continue;
        }

        let newPdf;
        try {
          // Try to load PDF with error handling
          newPdf = await PDFDocument.load(newPdfBytes, { 
            ignoreEncryption: true,
            parseSpeed: 1, // Slower but more robust parsing
          });
        } catch (loadError: any) {
          // Handle all types of PDF loading errors
          const errorMsg = loadError instanceof Error ? loadError.message : String(loadError);
          let userFriendlyMsg = '';
          
          // Check for specific error types
          if (errorMsg.includes('encrypted') || errorMsg.includes('password')) {
            userFriendlyMsg = 'File is encrypted and cannot be processed';
          } else if (
            errorMsg.includes('invalid') || 
            errorMsg.includes('parse') || 
            errorMsg.includes('object ref') ||
            errorMsg.includes('Invalid object') ||
            errorMsg.includes('Trying to parse invalid')
          ) {
            userFriendlyMsg = 'File is corrupted or has invalid structure';
          } else if (
            errorMsg.includes('undefined') || 
            errorMsg.includes('Expected instance') ||
            errorMsg.includes('but got instance of undefined')
          ) {
            // This is a common issue: pdf-lib is stricter than pdfjs-dist
            // The file can be viewed but not processed for merging
            userFriendlyMsg = 'File can be viewed but cannot be processed for merging. The PDF structure is not fully compatible with the merge engine. Try opening and re-saving the file in Adobe Reader.';
          } else {
            userFriendlyMsg = `Failed to load: ${errorMsg.substring(0, 100)}`;
          }
          
          skippedFiles.push(`${newFile.name}: ${userFriendlyMsg}`);
          // Don't log - this is expected when pdf-lib can't process the file
          // The image-based fallback will handle it silently
          continue; // Skip this file and continue with next
        }

        if (!newPdf) {
          skippedFiles.push(`${newFile.name}: PDF loaded but is null/undefined`);
          continue;
        }

        const newPages = newPdf.getPages();
        if (!newPages || newPages.length === 0) {
          skippedFiles.push(`${newFile.name}: PDF has no pages`);
          continue;
        }

        const newPageIndices = newPages.map((_, idx) => idx);
        let copiedNewPages;
        try {
          copiedNewPages = await mergedPdf.copyPages(newPdf, newPageIndices);
        } catch (copyError) {
          // Silently skip - this is expected when pdf-lib can't process the file
          // The image-based fallback will handle it
          const errorMsg = copyError instanceof Error ? copyError.message : 'Unknown error';
          skippedFiles.push(`${newFile.name}: Failed to copy pages - ${errorMsg}`);
          continue;
        }
        
        if (!copiedNewPages || copiedNewPages.length === 0) {
          skippedFiles.push(`${newFile.name}: No pages could be copied`);
          continue;
        }
        
        // Append pages to merged PDF
        copiedNewPages.forEach((page) => {
          if (page) {
            mergedPdf.addPage(page);
            hasProcessedAnyFile = true;
          }
        });
      } catch (fileError) {
        // Silently skip - this is expected when pdf-lib can't process the file
        // The image-based fallback will handle it
        const errorMsg = fileError instanceof Error ? fileError.message : 'Unknown error';
        skippedFiles.push(`${newFile.name}: ${errorMsg}`);
        continue;
      }
    }

    // Check if we actually added any new pages
    const originalPageCount = currentPdf.getPageCount();
    const mergedPages = mergedPdf.getPageCount();
    
    // If no new files were successfully processed, throw an error
    if (!hasProcessedAnyFile) {
      let errorMsg = '';
      if (skippedFiles.length > 0) {
        errorMsg = `No files could be merged. All ${newFiles.length} file(s) were skipped:\n\n${skippedFiles.map(f => `  • ${f}`).join('\n')}\n\n`;
        errorMsg += 'Important: These files can be viewed but cannot be processed for merging.\n';
        errorMsg += 'This is because pdf-lib (the merge engine) is stricter than the PDF viewer.\n\n';
        errorMsg += 'Possible solutions:\n';
        errorMsg += '  1. Open each file in Adobe Reader and save it again (File > Save As)\n';
        errorMsg += '  2. Use Adobe Reader\'s "Optimize PDF" feature to fix the structure\n';
        errorMsg += '  3. Try exporting the files to a new PDF format\n';
        errorMsg += '  4. Check if the file(s) are password-protected and unlock them first';
      } else {
        errorMsg = 'No files could be merged. All files may be corrupted or invalid.';
      }
      throw new Error(errorMsg);
    }
    
    // Check if we have any pages in the merged PDF (should always be true if hasProcessedAnyFile is true)
    if (mergedPages === 0) {
      throw new Error('Merged PDF has no pages');
    }

    // If some files were skipped but at least one succeeded, log a warning
    if (skippedFiles.length > 0 && hasProcessedAnyFile) {
      const addedPages = mergedPages - originalPageCount;
      console.warn(`[PDF Merge] Merge completed: Added ${addedPages} page(s) from ${newFiles.length - skippedFiles.length} file(s), but ${skippedFiles.length} file(s) were skipped:`, skippedFiles);
      
      // Show a warning to the user about skipped files
      const skippedMsg = skippedFiles.slice(0, 3).map(f => `  - ${f}`).join('\n');
      const moreMsg = skippedFiles.length > 3 ? `\n  ... and ${skippedFiles.length - 3} more` : '';
      console.warn(`[PDF Merge] Skipped files:\n${skippedMsg}${moreMsg}`);
    }

    // Generate merged PDF as bytes
    let mergedPdfBytes;
    try {
      mergedPdfBytes = await mergedPdf.save();
    } catch (saveError) {
      const errorMsg = saveError instanceof Error ? saveError.message : 'Unknown error';
      throw new Error(`Failed to save merged PDF: ${errorMsg}`);
    }

    if (!mergedPdfBytes || mergedPdfBytes.length === 0) {
      throw new Error('Merged PDF is empty');
    }

    // Create a new File object from the merged PDF
    const arrayBuffer = mergedPdfBytes.buffer.slice(
      mergedPdfBytes.byteOffset,
      mergedPdfBytes.byteOffset + mergedPdfBytes.byteLength
    ) as ArrayBuffer;
    
    const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
    const mergedFile = new File([blob], 'Merged_Document.pdf', {
      type: 'application/pdf',
      lastModified: Date.now(),
    });

    return mergedFile;
  } catch (error) {
    // Silently fail - the caller will try image-based approach
    // No need to log - this is expected when pdf-lib can't process certain PDFs
    throw error;
  }
}

export async function mergePdfFilesWithFallback(
  files: File[]
): Promise<{ file: File; usedImageBased: boolean }> {
  if (files.length === 0) {
    throw new Error('No PDF files to merge');
  }
  if (files.length === 1) {
    return { file: files[0], usedImageBased: false };
  }

  const [first, ...rest] = files;
  try {
    const file = await mergePDFs(first, rest);
    return { file, usedImageBased: false };
  } catch (directError) {
    console.warn('[PDF Merge] Direct merge failed, falling back to image-based merge:', directError);
    const file = await mergePDFsImageBased(first, rest);
    return { file, usedImageBased: true };
  }
}

