import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileText, Upload } from 'lucide-react';
import { loadPDFIntoStore } from '@/lib/pdf';

const Dropzone: React.FC = () => {
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && file.type === 'application/pdf') {
      try {
        await loadPDFIntoStore(file);
      } catch (error) {
        console.error('Error loading PDF:', error);
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    multiple: false,
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
            <p className="text-lg font-medium text-blue-600">Drop your PDF here</p>
          </>
        ) : (
          <>
            <FileText className="w-16 h-16 text-gray-400" />
            <div className="text-center">
              <p className="text-lg font-medium text-gray-700 mb-2">
                Drag and drop a PDF file here
              </p>
              <p className="text-sm text-gray-500">
                or click to browse
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Dropzone;

