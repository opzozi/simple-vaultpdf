import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileText, Upload } from 'lucide-react';
import { loadPDFIntoStore } from '@/lib/pdf';
import { usePdfStore } from '@/lib/pdf/store';
import { mergePdfFilesWithFallback } from '@/features/editor/mergeUtils';

const Dropzone: React.FC = () => {
  const { setViewMode, setError } = usePdfStore();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const pdfFiles = acceptedFiles.filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    if (pdfFiles.length === 0) {
      return;
    }

    try {
      if (pdfFiles.length === 1) {
        await loadPDFIntoStore(pdfFiles[0]);
        return;
      }

      const { file, usedImageBased } = await mergePdfFilesWithFallback(pdfFiles);
      await loadPDFIntoStore(file);
      setViewMode('grid');
      if (usedImageBased) {
        alert('Some PDFs could not be copied as vector pages, so they were merged as images. Text in those pages may no longer be selectable.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load PDF';
      console.error('Error loading PDF:', error);
      setError(message);
    }
  }, [setViewMode, setError]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    multiple: true,
  });

  return (
    <div
      {...getRootProps()}
      className={`
        w-full h-screen flex flex-col items-center justify-center
        border-2 border-dashed rounded-lg p-12
        transition-colors cursor-pointer
        ${isDragActive 
          ? 'border-blue-500 bg-blue-50' 
          : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
        }
      `}
    >
      <input {...getInputProps()} />
      
      <div className="flex flex-col items-center gap-4">
        {isDragActive ? (
          <>
            <Upload className="w-16 h-16 text-blue-500" />
            <p className="text-lg font-medium text-blue-600">Drop your PDF files here</p>
          </>
        ) : (
          <>
            <FileText className="w-16 h-16 text-gray-400" />
            <div className="text-center">
              <p className="text-lg font-medium text-gray-700 mb-2">
                Drag and drop PDF files here
              </p>
              <p className="text-sm text-gray-500">
                One file opens in the reader. Multiple files are merged, then opened in Organize.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Dropzone;
