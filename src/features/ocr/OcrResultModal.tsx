import React, { useState } from 'react';
import { X, Copy, Check, AlertTriangle, Download, FileText } from 'lucide-react';

interface OcrResultModalProps {
  text: string;
  confidence: number;
  pageNumber: number;
  totalPages?: number;
  nativePages?: number;
  ocrPages?: number;
  onClose: () => void;
}

const OcrResultModal: React.FC<OcrResultModalProps> = ({
  text,
  confidence,
  pageNumber,
  totalPages,
  nativePages = 0,
  ocrPages = 0,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const usedOcr = ocrPages > 0;
  const usedNative = nativePages > 0;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `extracted-text-${timestamp}.txt`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2000);
    } catch (error) {
      console.error('Failed to download text:', error);
    }
  };

  const sourceLabel = usedNative && usedOcr
    ? `${nativePages} page${nativePages === 1 ? '' : 's'} from PDF text, ${ocrPages} via OCR`
    : usedOcr
      ? 'OCR text extraction'
      : 'Copied from the PDF text layer';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {pageNumber === 0 && totalPages ? (
                <>Extracted Text ({totalPages} pages)</>
              ) : (
                <>Extracted Text - Page {pageNumber}</>
              )}
            </h2>
            <p className="text-sm text-gray-500">
              {usedOcr ? `OCR confidence: ${Math.round(confidence)}% | ` : null}
              {sourceLabel}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {usedNative && !usedOcr && (
          <div className="mx-4 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-2">
              <FileText className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-800">
                This PDF already contains text, so it was copied directly. No OCR was needed.
              </p>
            </div>
          </div>
        )}

        {usedOcr && (
          <div className="mx-4 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-yellow-800 font-medium mb-1">
                  OCR Accuracy Disclaimer
                </p>
                <p className="text-xs text-yellow-700">
                  {usedNative
                    ? 'Some pages had no usable text layer, so OCR was used there. OCR results may contain errors — please review them.'
                    : 'These pages looked scanned, so OCR was used. Results may vary in accuracy. Please review and correct the text. We do not take responsibility for OCR accuracy.'}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">
              {text || 'No text detected'}
            </pre>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200">
          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            {downloaded ? (
              <>
                <Check className="w-4 h-4" />
                Downloaded!
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download .txt
              </>
            )}
          </button>
          <button
            onClick={handleCopy}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy to Clipboard
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default OcrResultModal;
