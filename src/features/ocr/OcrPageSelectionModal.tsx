import React, { useState, useEffect } from 'react';
import { X, Check, CheckSquare, Square } from 'lucide-react';

interface OcrPageSelectionModalProps {
  totalPages: number;
  onConfirm: (selectedPages: number[]) => void;
  onClose: () => void;
}

const OcrPageSelectionModal: React.FC<OcrPageSelectionModalProps> = ({
  totalPages,
  onConfirm,
  onClose,
}) => {
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(true);

  useEffect(() => {
    // Initially select all pages
    const allPages = new Set(Array.from({ length: totalPages }, (_, i) => i + 1));
    setSelectedPages(allPages);
  }, [totalPages]);

  const handleTogglePage = (pageNum: number) => {
    const newSelected = new Set(selectedPages);
    if (newSelected.has(pageNum)) {
      newSelected.delete(pageNum);
    } else {
      newSelected.add(pageNum);
    }
    setSelectedPages(newSelected);
    setSelectAll(newSelected.size === totalPages);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedPages(new Set());
      setSelectAll(false);
    } else {
      const allPages = new Set(Array.from({ length: totalPages }, (_, i) => i + 1));
      setSelectedPages(allPages);
      setSelectAll(true);
    }
  };

  const handleConfirm = () => {
    const sortedPages = Array.from(selectedPages).sort((a, b) => a - b);
    if (sortedPages.length === 0) {
      alert('Please select at least one page');
      return;
    }
    onConfirm(sortedPages);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Select Pages for OCR
            </h2>
            <p className="text-sm text-gray-500">
              {selectedPages.size} of {totalPages} pages selected
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Select All Button */}
          <button
            onClick={handleSelectAll}
            className="mb-4 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
          >
            {selectAll ? (
              <>
                <CheckSquare className="w-4 h-4" />
                Deselect All
              </>
            ) : (
              <>
                <Square className="w-4 h-4" />
                Select All
              </>
            )}
          </button>

          {/* Page Grid */}
          <div className="grid grid-cols-10 gap-2">
            {Array.from({ length: totalPages }, (_, i) => {
              const pageNum = i + 1;
              const isSelected = selectedPages.has(pageNum);
              
              return (
                <button
                  key={pageNum}
                  onClick={() => handleTogglePage(pageNum)}
                  className={`p-3 rounded-lg border-2 transition-colors flex items-center justify-center ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-700'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {isSelected ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-medium">{pageNum}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Process {selectedPages.size} Page{selectedPages.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OcrPageSelectionModal;

