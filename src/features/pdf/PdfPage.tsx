import React, { useEffect, useRef, useState } from 'react';
import { usePdfStore } from '@/lib/pdf/store';
import type { RenderTask } from 'pdfjs-dist';

interface PdfPageProps {
  pageNumber: number;
}

const PdfPage: React.FC<PdfPageProps> = ({ pageNumber }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { pdfDocument, scale } = usePdfStore();

  useEffect(() => {
    if (!pdfDocument || !canvasRef.current) return;

    const renderPage = async () => {
      // Cancel previous render task if it exists
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }

      try {
        setIsLoading(true);
        setError(null);

        const page = await pdfDocument.getPage(pageNumber);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        // Calculate viewport with the current scale
        const viewport = page.getViewport({ scale });
        
        // Set canvas size directly - this will make it render at the correct size
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // Clear the canvas before rendering
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Render PDF page into canvas context
        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        // Store the render task and wait for it to complete
        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        
        await renderTask.promise;
        renderTaskRef.current = null;
        setIsLoading(false);
      } catch (err) {
        // Ignore cancellation errors - check if it's a RenderingCancelledException
        // The error might be thrown as a string or have a specific name
        if (
          err instanceof Error && 
          (err.name === 'RenderingCancelledException' || err.message.includes('cancelled'))
        ) {
          return;
        }
        
        const errorMessage = err instanceof Error ? err.message : 'Failed to render page';
        setError(errorMessage);
        setIsLoading(false);
        console.error(`Error rendering page ${pageNumber}:`, err);
        renderTaskRef.current = null;
      }
    };

    renderPage();

    // Cleanup: cancel render task on unmount or when dependencies change
    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [pdfDocument, pageNumber, scale]);

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 bg-red-50 border border-red-200 rounded">
        <p className="text-red-600">Error loading page {pageNumber}: {error}</p>
      </div>
    );
  }

  return (
    <div className="mb-4 flex justify-center bg-white shadow-sm rounded border border-gray-200 p-4 relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 rounded z-10">
          <p className="text-gray-600">Loading page {pageNumber}...</p>
        </div>
      )}
      <div className="flex justify-center overflow-x-auto">
        <canvas
          ref={canvasRef}
          data-page-number={pageNumber}
          style={{ 
            display: isLoading ? 'none' : 'block'
          }}
        />
      </div>
    </div>
  );
};

export default PdfPage;

