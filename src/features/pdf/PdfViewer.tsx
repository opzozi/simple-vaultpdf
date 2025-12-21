import React, { useState, useRef, useEffect } from 'react';
import { usePdfStore } from '@/lib/pdf/store';
import PdfPage from './PdfPage';
import { ZoomIn, ZoomOut, RotateCcw, Grid3x3, BookOpen, Save, Scan, Languages, ImageDown, ChevronDown } from 'lucide-react';
import { savePdfToFile } from '@/lib/pdf/modifier';
import { useOcr } from '@/features/ocr/useOcr';
import OcrResultModal from '@/features/ocr/OcrResultModal';
import LanguageDownloadModal from '@/features/ocr/LanguageDownloadModal';
import OcrPageSelectionModal from '@/features/ocr/OcrPageSelectionModal';
import { saveCanvasAsImage, getAllPageCanvases, findVisiblePageCanvas, renderPageToHighResCanvas } from './imageExport';
import type { ImageFormat } from './imageExport';

const PdfViewer: React.FC = () => {
  const { totalPages, scale, setScale, reset, viewMode, setViewMode, file, pages, isLoading } = usePdfStore();
  const { processPages, isProcessing, progress, currentPage: ocrCurrentPage, totalPages: ocrTotalPages, result, error, clearResult } = useOcr();
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showPageSelectionModal, setShowPageSelectionModal] = useState(false);
  const [showImageExportMenu, setShowImageExportMenu] = useState(false);
  const imageExportMenuRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => {
    setScale(Math.min(scale + 0.25, 3.0));
  };

  const handleZoomOut = () => {
    setScale(Math.max(scale - 0.25, 0.5));
  };

  const handleReset = () => {
    reset();
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

  const handleSaveAsImage = async (format: ImageFormat) => {
    try {
      const { pdfDocument } = usePdfStore.getState();
      
      if (!pdfDocument) {
        alert('PDF document is not loaded. Please wait for the PDF to load.');
        return;
      }

      // Get all page canvases to find the visible page
      const canvases = getAllPageCanvases();
      
      if (canvases.length === 0) {
        alert('No pages are currently rendered. Please wait for the PDF to load.');
        return;
      }

      // Find the currently visible page
      const visiblePage = findVisiblePageCanvas(canvases);
      
      if (!visiblePage) {
        alert('Could not find a visible page. Please scroll to a page.');
        return;
      }

      // Render the page at high resolution for better quality
      // PNG: use 3.0x scale for maximum quality (lossless)
      // JPG: use 2.5x scale (good balance between quality and file size)
      const exportScale = format === 'png' ? 3.0 : 2.5;
      
      const highResCanvas = await renderPageToHighResCanvas(
        pdfDocument,
        visiblePage.pageNumber,
        exportScale
      );

      // Save the high-resolution canvas as image
      // PNG: lossless, no quality parameter needed
      // JPG: use high quality (0.95)
      saveCanvasAsImage(highResCanvas, visiblePage.pageNumber, format, format === 'jpg' ? 0.95 : 1.0);
      setShowImageExportMenu(false);
    } catch (error) {
      console.error('Error saving page as image:', error);
      alert(error instanceof Error ? error.message : 'Failed to save image. Please try again.');
    }
  };

  // Close image export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (imageExportMenuRef.current && !imageExportMenuRef.current.contains(event.target as Node)) {
        setShowImageExportMenu(false);
      }
    };

    if (showImageExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showImageExportMenu]);

  return (
    <div className="w-full h-screen flex flex-col bg-gray-100">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-900">
            PDF Viewer
          </h2>
          <span className="text-sm text-gray-500">
            {totalPages} {totalPages === 1 ? 'page' : 'pages'}
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

          {viewMode === 'reader' && (
            <>
              <button
                onClick={handleZoomOut}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-5 h-5 text-gray-600" />
              </button>
              <span className="text-sm font-medium text-gray-700 min-w-[60px] text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-5 h-5 text-gray-600" />
              </button>
              
              {/* Save as Image Button with Dropdown */}
              <div className="relative" ref={imageExportMenuRef}>
                <button
                  onClick={() => setShowImageExportMenu(!showImageExportMenu)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-1"
                  title="Save Current Page as Image"
                >
                  <ImageDown className="w-5 h-5 text-gray-600" />
                  <ChevronDown className="w-4 h-4 text-gray-600" />
                </button>
                
                {showImageExportMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <button
                      onClick={() => handleSaveAsImage('png')}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2"
                    >
                      <ImageDown className="w-4 h-4" />
                      Save as PNG
                    </button>
                    <button
                      onClick={() => handleSaveAsImage('jpg')}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2 border-t border-gray-200"
                    >
                      <ImageDown className="w-4 h-4" />
                      Save as JPG
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
          
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
            onClick={handleReset}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Load New PDF
          </button>
        </div>
      </div>

      {/* PDF Pages Container */}
      <div className="flex-1 overflow-y-auto overflow-x-auto p-4">
        <div className="mx-auto" style={{ maxWidth: '100%' }}>
          {Array.from({ length: totalPages }, (_, i) => (
            <PdfPage key={i + 1} pageNumber={i + 1} />
          ))}
        </div>
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

export default PdfViewer;

