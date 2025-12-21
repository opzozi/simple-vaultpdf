import React from 'react';
import { usePdfStore } from '@/lib/pdf/store';
import Dropzone from '@/features/pdf/Dropzone';
import PdfViewer from '@/features/pdf/PdfViewer';
import PageGrid from '@/features/editor/PageGrid';
import '@/lib/pdf/init'; // Initialize PDF.js worker

const App: React.FC = () => {
  const { pdfDocument, error, viewMode } = usePdfStore();

  // Show error if PDF loading failed
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Error Loading PDF</h2>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {!pdfDocument ? (
        <Dropzone />
      ) : viewMode === 'reader' ? (
        <PdfViewer />
      ) : (
        <PageGrid />
      )}
    </div>
  );
};

export default App;
