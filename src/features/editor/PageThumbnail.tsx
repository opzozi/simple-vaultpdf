import React, { useEffect, useRef } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { RenderTask } from 'pdfjs-dist';
import { Trash2, RotateCw, RotateCcw } from 'lucide-react';

interface PageThumbnailProps {
  pdfDocument: PDFDocumentProxy;
  pageNumber: number;
  rotation: number;
  isDeleted: boolean;
  isSelected?: boolean;
  onDelete: () => void;
  onRotate: () => void;
  onRestore?: () => void;
  onToggleSelect?: () => void;
  dragHandleProps?: any;
}

const PageThumbnail: React.FC<PageThumbnailProps> = ({
  pdfDocument,
  pageNumber,
  rotation,
  isDeleted,
  isSelected = false,
  onDelete,
  onRotate,
  onRestore,
  onToggleSelect,
  dragHandleProps,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);

  useEffect(() => {
    if (!pdfDocument || !canvasRef.current) return;

    const renderThumbnail = async () => {
      // Cancel previous render task if it exists
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }

      try {
        const page = await pdfDocument.getPage(pageNumber);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        const totalRotation = ((page.rotate + rotation) % 360 + 360) % 360;
        const viewport = page.getViewport({ scale: 0.3, rotation: totalRotation });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // Clear the canvas before rendering
        context.clearRect(0, 0, canvas.width, canvas.height);

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        // Store the render task and wait for it to complete
        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        
        await renderTask.promise;
        renderTaskRef.current = null;
      } catch (err) {
        // Ignore cancellation errors
        if (
          err instanceof Error && 
          (err.name === 'RenderingCancelledException' || err.message.includes('cancelled'))
        ) {
          return;
        }
        console.error(`Error rendering thumbnail for page ${pageNumber}:`, err);
        renderTaskRef.current = null;
      }
    };

    renderThumbnail();

    // Cleanup: cancel render task on unmount or when dependencies change
    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [pdfDocument, pageNumber, rotation]);

  const handleCardClick = (e: React.MouseEvent) => {
    // Ctrl+Click or Cmd+Click to toggle selection
    if ((e.ctrlKey || e.metaKey) && onToggleSelect && !isDeleted) {
      e.stopPropagation();
      e.preventDefault();
      onToggleSelect();
    }
  };

  return (
    <div
      className={`
        relative group border-2 rounded-lg overflow-hidden
        ${isDeleted 
          ? 'border-red-300 bg-red-50 opacity-50' 
          : isSelected
          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
          : 'border-gray-200 bg-white hover:border-blue-400'
        }
        transition-all
      `}
      onClick={handleCardClick}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-auto block cursor-move"
        style={{
          opacity: isDeleted ? 0.5 : 1,
        }}
        {...dragHandleProps}
      />
      
      {/* Selection checkbox */}
      {!isDeleted && onToggleSelect && (
        <div className="absolute top-2 left-2 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onToggleSelect();
            }}
            onClick={(e) => {
              e.stopPropagation();
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            className="w-5 h-5 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            title="Select page"
          />
        </div>
      )}
      
      {/* Page number badge */}
      <div className={`absolute top-2 ${onToggleSelect && !isDeleted ? 'right-2' : 'left-2'} bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded`}>
        {pageNumber}
      </div>
      
      {/* Hover overlay with actions */}
      {!isDeleted && (
        <div 
          className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 pointer-events-none"
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onRotate();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="p-2 bg-white rounded-lg shadow-lg hover:bg-gray-100 transition-colors pointer-events-auto"
            title="Rotate"
          >
            <RotateCw className="w-4 h-4 text-gray-700" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onDelete();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="p-2 bg-red-500 rounded-lg shadow-lg hover:bg-red-600 transition-colors pointer-events-auto"
            title="Delete"
          >
            <Trash2 className="w-4 h-4 text-white" />
          </button>
        </div>
      )}
      
      {/* Deleted indicator */}
      {isDeleted && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-red-100 bg-opacity-80">
          <span className="text-red-600 font-semibold">Deleted</span>
          {onRestore && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onRestore();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="px-3 py-1.5 text-sm font-medium bg-white text-red-700 rounded-lg shadow hover:bg-red-50 transition-colors flex items-center gap-1.5"
              title="Restore page"
            >
              <RotateCcw className="w-4 h-4" />
              Restore
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default PageThumbnail;

