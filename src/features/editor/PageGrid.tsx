import React, { useState, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { usePdfStore } from '@/lib/pdf/store';
import PageThumbnail from './PageThumbnail';
import { Grid3x3, BookOpen, Save, RotateCcw, Scan, Languages, Plus, CheckSquare, X, Download } from 'lucide-react';
import { savePdfToFile } from '@/lib/pdf/modifier';
import { useOcr } from '@/features/ocr/useOcr';
import OcrResultModal from '@/features/ocr/OcrResultModal';
import LanguageDownloadModal from '@/features/ocr/LanguageDownloadModal';
import OcrPageSelectionModal from '@/features/ocr/OcrPageSelectionModal';
import { mergePDFs } from './mergeUtils';
import { mergePDFsImageBased } from './mergeUtilsImageBased';
import { extractPagesToPDF } from './extractUtils';
import { loadPDFIntoStore } from '@/lib/pdf';

interface SortablePageItemProps {
  id: string;
  pageNumber: number;
  rotation: number;
  isDeleted: boolean;
}

const SortablePageItem: React.FC<SortablePageItemProps> = ({
  id,
  pageNumber,
  rotation,
  isDeleted,
}) => {
  const { pdfDocument, rotatePage, deletePage, selectedPageIds, togglePageSelection: toggleSelection } = usePdfStore();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (!pdfDocument) return null;

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <PageThumbnail
        pdfDocument={pdfDocument}
        pageNumber={pageNumber}
        rotation={rotation}
        isDeleted={isDeleted}
        isSelected={selectedPageIds.has(id)}
        onDelete={() => deletePage(id)}
        onRotate={() => rotatePage(id)}
        onToggleSelect={() => toggleSelection(id)}
        dragHandleProps={listeners}
      />
    </div>
  );
};

const PageGrid: React.FC = () => {
  const { 
    pdfDocument, 
    pages, 
    reorderPages, 
    setViewMode, 
    viewMode, 
    file, 
    totalPages, 
    isLoading, 
    reset, 
    setLoading, 
    setError,
    selectedPageIds,
    selectAll,
    deselectAll,
    deleteUnselected,
  } = usePdfStore();
  const { processPages, isProcessing, progress, currentPage: ocrCurrentPage, totalPages: ocrTotalPages, result, error, clearResult } = useOcr();
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showPageSelectionModal, setShowPageSelectionModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Create sensors separately to avoid hook call issues
  const pointerSensor = useSensor(PointerSensor);
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });
  
  // Always call hooks at the top level, before any conditional returns
  const sensors = useSensors(pointerSensor, keyboardSensor);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = pages.findIndex((page) => page.id === active.id);
      const newIndex = pages.findIndex((page) => page.id === over.id);
      
      reorderPages(oldIndex, newIndex);
    }
  };

  const handleSave = async () => {
    if (!file || pages.length === 0) return;
    
    try {
      await savePdfToFile(file, pages);
    } catch (error) {
      console.error('Error saving PDF:', error);
      alert('Failed to save PDF. Please try again.');
    }
  };

  const handleOcr = () => {
    // Show page selection modal
    setShowPageSelectionModal(true);
  };

  const handlePageSelectionConfirm = async (selectedPages: number[]) => {
    setShowPageSelectionModal(false);
    console.log('Starting OCR for pages:', selectedPages);
    try {
      await processPages(selectedPages);
    } catch (err) {
      console.error('Failed to process pages:', err);
    }
  };

  const handleAddPDF = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0 || !file) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Convert FileList to Array
      const newFilesArray = Array.from(selectedFiles);

      // Always try image-based merge first to avoid pdf-lib internal errors
      // This prevents "Trying to parse invalid object" errors from appearing
      let mergedFile: File;
      let usedImageBased = true;
      
      try {
        mergedFile = await mergePDFsImageBased(file, newFilesArray);
      } catch (imageBasedError) {
        // If image-based fails, try direct merge as fallback
        try {
          mergedFile = await mergePDFs(file, newFilesArray);
          usedImageBased = false;
        } catch (directMergeError) {
          // Both methods failed
          const imageErrorMsg = imageBasedError instanceof Error ? imageBasedError.message : String(imageBasedError);
          throw new Error(`PDF merge failed: ${imageErrorMsg}`);
        }
      }

      // Validate merged file before reloading
      if (!mergedFile || mergedFile.size === 0) {
        throw new Error('Merged PDF is empty or invalid');
      }

      // Try to reload the merged PDF into the store
      try {
        await loadPDFIntoStore(mergedFile);
        
        // Show success message if merge completed
        const originalPageCount = totalPages;
        // Wait a bit for the store to update
        await new Promise(resolve => setTimeout(resolve, 100));
        const newPageCount = usePdfStore.getState().totalPages;
        const addedPages = newPageCount - originalPageCount;
        
        if (addedPages > 0) {
          const method = usedImageBased ? 'image-based' : 'direct';
          console.log(`[PDF Merge] Successfully merged: Added ${addedPages} page(s) from ${newFilesArray.length} file(s) using ${method} method`);
        } else {
          console.warn(`[PDF Merge] Warning: Merge completed but no new pages were added`);
        }
      } catch (loadError) {
        // If loading the merged PDF fails, it might be corrupted
        const loadErrorMsg = loadError instanceof Error ? loadError.message : 'Unknown error';
        throw new Error(`Merged PDF was created but could not be loaded: ${loadErrorMsg}. The merged file may be corrupted.`);
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      let errorMessage = 'Failed to merge PDFs';
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Provide more specific error messages
        if (errorMessage.includes('No files could be merged') || errorMessage.includes('skipped file(s)')) {
          // Keep the detailed message about skipped files
          // It already contains the list of skipped files
        } else if (errorMessage.includes('could not be loaded')) {
          // Keep the message about loading failure
        } else if (errorMessage.includes('Both merge methods failed')) {
          // Keep the combined error message
        } else if (errorMessage.includes('encrypted') || errorMessage.includes('password')) {
          errorMessage = 'One or more PDF files are encrypted and cannot be processed. Please unlock them first.';
        } else if (
          errorMessage.includes('invalid') || 
          errorMessage.includes('parse') || 
          errorMessage.includes('object ref') ||
          errorMessage.includes('Invalid object') ||
          errorMessage.includes('corrupted')
        ) {
          errorMessage = 'One or more PDF files are corrupted or have an invalid structure. Please try with different files.';
        } else if (
          errorMessage.includes('undefined') || 
          errorMessage.includes('Expected instance') ||
          errorMessage.includes('unsupported format')
        ) {
          errorMessage = 'One or more PDF files could not be processed. The file may be corrupted or in an unsupported format.';
        }
      }
      
      setError(errorMessage);
      
      // Log error details properly (not as [object Object])
      if (error instanceof Error) {
        console.error('[PDF Merge] Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack,
        });
      } else {
        console.error('[PDF Merge] Error details:', String(error));
      }
      
      // Show alert with detailed error info
      let alertMessage = `PDF Merge Error:\n\n${errorMessage}`;
      
      // Don't add extra text if the error message already contains solutions
      if (!errorMessage.includes('Possible solutions:')) {
        if (errorMessage.includes('No files could be merged')) {
          alertMessage += '\n\nPlease check the console for details about which files failed and why.';
        } else {
          alertMessage += '\n\nPlease check the console for more details.';
        }
      }
      
      alert(alertMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleKeepSelected = () => {
    if (selectedPageIds.size === 0) return;
    deleteUnselected();
  };

  const handleDeleteSelected = () => {
    if (selectedPageIds.size === 0) return;
    // Use store actions directly instead of getState
    const { deletePage } = usePdfStore.getState();
    selectedPageIds.forEach((id) => {
      const page = pages.find((p) => p.id === id);
      if (page && !page.isDeleted) {
        deletePage(id);
      }
    });
    deselectAll();
  };

  const handleExtractSelected = async () => {
    if (!file || selectedPageIds.size === 0) return;

    try {
      setLoading(true);
      setError(null);

      const extractedFile = await extractPagesToPDF(file, pages, selectedPageIds);

      // Download the extracted PDF
      const arrayBuffer = await extractedFile.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = extractedFile.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to extract pages';
      setError(errorMessage);
      console.error('Error extracting pages:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedCount = selectedPageIds.size;

  // Early return after all hooks
  if (!pdfDocument || pages.length === 0) {
    return (
      <div className="w-full h-screen flex flex-col bg-gray-100">
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">PDF Editor</h2>
        </div>
        <div className="flex items-center justify-center p-8 flex-1">
          <p className="text-gray-500">No pages to display</p>
        </div>
      </div>
    );
  }

  const activePagesCount = pages.filter((p) => !p.isDeleted).length;

  return (
    <div className="w-full h-screen flex flex-col bg-gray-100">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-900">PDF Editor</h2>
          <span className="text-sm text-gray-500">
            {activePagesCount} / {totalPages} pages
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Mode Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1 mr-2">
            <button
              onClick={() => setViewMode('reader')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                viewMode === 'reader'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Read
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                viewMode === 'grid'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Grid3x3 className="w-4 h-4" />
              Organize
            </button>
          </div>
          
          <div className="w-px h-6 bg-gray-300 mx-2" />
          
          {/* Select All / Deselect All Buttons */}
          {selectedCount > 0 ? (
            <button
              onClick={deselectAll}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
              title="Deselect all pages"
            >
              <X className="w-4 h-4" />
              Deselect All
            </button>
          ) : (
            <button
              onClick={selectAll}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
              title="Select all pages"
            >
              <CheckSquare className="w-4 h-4" />
              Select All
            </button>
          )}
          
          <div className="w-px h-6 bg-gray-300 mx-2" />
          
          {/* Add PDF Button (only in Organize Mode) */}
          <button
            onClick={handleAddPDF}
            disabled={isLoading || !file}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
            title="Add PDF files to merge with current document"
          >
            <Plus className="w-4 h-4" />
            Add PDF
          </button>
          
          {/* Hidden file input for PDF merging */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            multiple
            onChange={handleFileInputChange}
            className="hidden"
          />
          
          <div className="w-px h-6 bg-gray-300 mx-2" />
          
          {/* OCR Button */}
          <button
            onClick={handleOcr}
            disabled={isProcessing || isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
            title="OCR / Extract Text - Please always verify the accuracy of results!"
          >
            <Scan className="w-4 h-4" />
            {isProcessing ? (
              ocrCurrentPage > 0 ? (
                `OCR ${ocrCurrentPage}/${ocrTotalPages} (${Math.round(progress)}%)`
              ) : (
                `OCR ${Math.round(progress)}%`
              )
            ) : (
              'OCR All Pages'
            )}
          </button>
          
          {/* Language Settings Button */}
          <button
            onClick={() => setShowLanguageModal(true)}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
            title="OCR Language Settings"
          >
            <Languages className="w-4 h-4" />
          </button>
          
          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={isLoading || !file}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save PDF
          </button>
          
          <button
            onClick={reset}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Load New PDF
          </button>
        </div>
      </div>

      {/* Bulk Action Toolbar - Only show when pages are selected */}
      {selectedCount > 0 && (
        <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <CheckSquare className="w-5 h-5" />
            <span className="font-medium">
              {selectedCount} {selectedCount === 1 ? 'page' : 'pages'} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExtractSelected}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium bg-white text-blue-600 hover:bg-blue-50 disabled:bg-gray-300 disabled:text-gray-500 rounded-lg transition-colors flex items-center gap-2"
              title="Extract selected pages to a new PDF file"
            >
              <Download className="w-4 h-4" />
              Extract to New PDF
            </button>
            <button
              onClick={handleKeepSelected}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:text-gray-500 rounded-lg transition-colors flex items-center gap-2"
              title="Keep only selected pages (delete all others)"
            >
              <CheckSquare className="w-4 h-4" />
              Keep Only These
            </button>
            <button
              onClick={handleDeleteSelected}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium bg-red-500 hover:bg-red-600 disabled:bg-gray-300 disabled:text-gray-500 rounded-lg transition-colors flex items-center gap-2"
              title="Delete selected pages"
            >
              <X className="w-4 h-4" />
              Delete Selected
            </button>
            <button
              onClick={deselectAll}
              className="px-3 py-2 text-sm font-medium bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors"
              title="Clear selection"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Grid Container */}
      <div className="flex-1 overflow-y-auto p-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={pages.map((page) => page.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {pages.map((page) => (
                <SortablePageItem
                  key={page.id}
                  id={page.id}
                  pageNumber={page.pageNumber}
                  rotation={page.rotation}
                  isDeleted={page.isDeleted}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* OCR Result Modal */}
      {result && (
        <OcrResultModal
          text={result.text}
          confidence={result.confidence}
          pageNumber={result.pageNumber}
          totalPages={result.pageNumber === 0 ? totalPages : undefined}
          onClose={clearResult}
        />
      )}

      {/* OCR Error Alert */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg max-w-md z-50">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h3 className="font-semibold text-red-800 mb-1">OCR Error</h3>
              <p className="text-sm text-red-600">{error}</p>
              {error.toLowerCase().includes('language') || error.toLowerCase().includes('nyelv') ? (
                <button
                  onClick={() => setShowLanguageModal(true)}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Download additional languages
                </button>
              ) : null}
            </div>
            <button
              onClick={() => clearResult()}
              className="text-red-600 hover:text-red-800"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Page Selection Modal */}
      {showPageSelectionModal && (
        <OcrPageSelectionModal
          totalPages={totalPages}
          onConfirm={handlePageSelectionConfirm}
          onClose={() => setShowPageSelectionModal(false)}
        />
      )}

      {/* Language Settings Modal */}
      {showLanguageModal && (
        <LanguageDownloadModal
          showSettings={true}
          onClose={() => setShowLanguageModal(false)}
          onLanguageDownloaded={() => {
            setShowLanguageModal(false);
            // Optionally reload or refresh
          }}
        />
      )}
    </div>
  );
};

export default PageGrid;

