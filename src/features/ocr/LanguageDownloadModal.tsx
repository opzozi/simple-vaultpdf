import React, { useState, useEffect } from 'react';
import { X, Download, Check, AlertCircle, Trash2, CheckSquare, Square } from 'lucide-react';
import { getAvailableLanguages } from '@/lib/ocr/tesseractConfig';
import { getSelectedLanguages, setSelectedLanguages, getDeletedLanguages, addDeletedLanguage, removeDeletedLanguage } from '@/lib/ocr/storage';

interface LanguageInfo {
  code: string;
  name: string;
  downloadUrl: string;
}

const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'eng', name: 'English', downloadUrl: 'https://github.com/tesseract-ocr/tessdata/raw/main/eng.traineddata.gz' },
  { code: 'hun', name: 'Hungarian', downloadUrl: 'https://github.com/tesseract-ocr/tessdata/raw/main/hun.traineddata.gz' },
  { code: 'deu', name: 'German', downloadUrl: 'https://github.com/tesseract-ocr/tessdata/raw/main/deu.traineddata.gz' },
  { code: 'fra', name: 'French', downloadUrl: 'https://github.com/tesseract-ocr/tessdata/raw/main/fra.traineddata.gz' },
  { code: 'spa', name: 'Spanish', downloadUrl: 'https://github.com/tesseract-ocr/tessdata/raw/main/spa.traineddata.gz' },
  { code: 'ita', name: 'Italian', downloadUrl: 'https://github.com/tesseract-ocr/tessdata/raw/main/ita.traineddata.gz' },
  { code: 'por', name: 'Portuguese', downloadUrl: 'https://github.com/tesseract-ocr/tessdata/raw/main/por.traineddata.gz' },
  { code: 'rus', name: 'Russian', downloadUrl: 'https://github.com/tesseract-ocr/tessdata/raw/main/rus.traineddata.gz' },
  { code: 'chi_sim', name: 'Chinese (Simplified)', downloadUrl: 'https://github.com/tesseract-ocr/tessdata/raw/main/chi_sim.traineddata.gz' },
  { code: 'jpn', name: 'Japanese', downloadUrl: 'https://github.com/tesseract-ocr/tessdata/raw/main/jpn.traineddata.gz' },
];

interface LanguageDownloadModalProps {
  onClose: () => void;
  onLanguageDownloaded?: () => void;
  showSettings?: boolean; // Show language selection settings
}

const LanguageDownloadModal: React.FC<LanguageDownloadModalProps> = ({
  onClose,
  onLanguageDownloaded,
  showSettings = false,
}) => {
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguagesState] = useState<string[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadAvailableLanguages();
    if (showSettings) {
      loadSelectedLanguages();
    }
  }, [showSettings]);

  const loadAvailableLanguages = async () => {
    try {
      const allLanguages = await getAvailableLanguages();
      const deletedLanguages = await getDeletedLanguages();
      
      // Filter out deleted languages
      const filteredLanguages = allLanguages.filter(lang => !deletedLanguages.includes(lang));
      
      console.log('[LOAD] All languages from filesystem:', allLanguages);
      console.log('[LOAD] Deleted languages:', deletedLanguages);
      console.log('[LOAD] Filtered available languages:', filteredLanguages);
      
      setAvailableLanguages(filteredLanguages);
    } catch (err) {
      console.error('Failed to load available languages:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSelectedLanguages = async () => {
    try {
      const selected = await getSelectedLanguages();
      setSelectedLanguagesState(selected);
    } catch (err) {
      console.error('Failed to load selected languages:', err);
    }
  };

  const handleToggleLanguage = async (code: string) => {
    let newSelected: string[];
    
    if (selectedLanguages.includes(code)) {
      // Trying to deselect - check if it's the last one
      newSelected = selectedLanguages.filter(l => l !== code);
      
      // If this would leave us with no languages, keep at least English
      if (newSelected.length === 0) {
        console.log(`[TOGGLE] Cannot deselect last language ${code}, keeping English`);
        newSelected = ['eng'];
        // Ensure English is available
        if (!availableLanguages.includes('eng')) {
          setAvailableLanguages(prev => [...prev, 'eng']);
        }
        // Show info (not error) - this is expected behavior
        console.info('At least one language must be selected. English was automatically selected.');
      }
    } else {
      // Trying to select - just add it
      newSelected = [...selectedLanguages, code];
    }
    
    setSelectedLanguagesState(newSelected);
    await setSelectedLanguages(newSelected);
  };

  const handleDeleteLanguage = async (code: string) => {
    // First click: show confirm state
    if (!showDeleteConfirm || showDeleteConfirm !== code) {
      setShowDeleteConfirm(code);
      return;
    }

    // Second click: actually delete
    try {
      console.log(`[DELETE] Starting deletion of language: ${code}`);
      console.log(`[DELETE] Current selected languages:`, selectedLanguages);
      console.log(`[DELETE] Current available languages:`, availableLanguages);

      // Remove from selected languages if it's selected
      let newSelected = [...selectedLanguages];
      if (selectedLanguages.includes(code)) {
        newSelected = selectedLanguages.filter(l => l !== code);
        console.log(`[DELETE] Removing from selected. New list:`, newSelected);
        
        // If this was the last selected language, default to English
        if (newSelected.length === 0) {
          console.log(`[DELETE] Last language removed, defaulting to English`);
          newSelected = ['eng'];
          // Also ensure English is in available languages (it should be)
          if (!availableLanguages.includes('eng')) {
            setAvailableLanguages(prev => [...prev, 'eng']);
          }
        }
        
        setSelectedLanguagesState(newSelected);
        await setSelectedLanguages(newSelected);
        console.log(`[DELETE] Successfully removed ${code} from selected languages in storage`);
        console.log(`[DELETE] New selected languages:`, newSelected);
        
        // Verify it was saved
        const verified = await getSelectedLanguages();
        console.log(`[DELETE] Verified saved languages:`, verified);
        
        if (newSelected.length === 1 && newSelected[0] === 'eng') {
          setError(null); // Clear error if we auto-selected English
        }
      } else {
        console.log(`[DELETE] ${code} was not in selected languages`);
      }

      // Add to deleted languages list (so it won't show up again)
      await addDeletedLanguage(code);
      console.log(`[DELETE] Added ${code} to deleted languages list`);
      
      // Remove from available languages list (UI only - file still exists)
      setAvailableLanguages(prev => {
        const filtered = prev.filter(l => l !== code);
        console.log(`[DELETE] Removed ${code} from UI. New available list:`, filtered);
        return filtered;
      });

      setShowDeleteConfirm(null);
      setError(null); // Clear any previous errors
      
      // Reload selected languages to ensure UI is in sync
      if (showSettings) {
        setTimeout(async () => {
          const reloaded = await getSelectedLanguages();
          console.log(`[DELETE] Reloaded selected languages:`, reloaded);
          setSelectedLanguagesState(reloaded);
        }, 200);
      }
    } catch (err) {
      console.error('[DELETE] Failed to delete language:', err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(`Failed to remove language: ${errorMsg}`);
      setShowDeleteConfirm(null);
      // Don't throw - just show error in UI
    }
  };

  const handleDownload = async (language: LanguageInfo) => {
    setDownloading(language.code);
    setError(null);

    try {
      // Download the language file
      const response = await fetch(language.downloadUrl);
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`);
      }

      const blob = await response.blob();
      
      // Save to extension's public/tesseract directory
      // Note: Chrome Extensions can't directly write to their own directories
      // We'll need to use the Downloads API or show instructions
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${language.code}.traineddata.gz`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Show instructions
      alert(
        `Language file downloaded!\n\n` +
        `Please save it to: public/tesseract/${language.code}.traineddata.gz\n\n` +
        `Then reload the extension.`
      );

      // Remove from deleted languages if it was deleted before
      await removeDeletedLanguage(language.code);
      console.log(`[DOWNLOAD] Removed ${language.code} from deleted languages list`);
      
      // Reload available languages to show the newly downloaded language
      await loadAvailableLanguages();
      
      if (onLanguageDownloaded) {
        onLanguageDownloaded();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Download failed';
      setError(`Failed to download ${language.name}: ${errorMessage}`);
      console.error('Download error:', err);
    } finally {
      setDownloading(null);
    }
  };

  const isLanguageAvailable = (code: string) => {
    return availableLanguages.includes(code);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {showSettings ? 'OCR Language Settings' : 'Download OCR Languages'}
            </h2>
            <p className="text-sm text-gray-500">
              {showSettings 
                ? 'Select which languages to use for OCR processing'
                : 'Download additional language packs to improve OCR accuracy'}
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
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading available languages...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="w-5 h-5" />
                <p className="font-medium">{error}</p>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            {SUPPORTED_LANGUAGES.map((language) => {
              const isAvailable = isLanguageAvailable(language.code);
              const isDownloading = downloading === language.code;

              return (
                <div
                  key={language.code}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    {showSettings && isAvailable ? (
                      <button
                        onClick={() => handleToggleLanguage(language.code)}
                        className={`p-2 rounded-lg transition-colors ${
                          selectedLanguages.includes(language.code)
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        title={selectedLanguages.includes(language.code) ? 'Deselect' : 'Select'}
                      >
                        {selectedLanguages.includes(language.code) ? (
                          <CheckSquare className="w-5 h-5" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    ) : isAvailable ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <div className="w-5 h-5" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {language.name}
                        {showSettings && isAvailable && selectedLanguages.includes(language.code) && (
                          <span className="ml-2 text-xs text-blue-600">(Selected)</span>
                        )}
                      </p>
                      <p className="text-sm text-gray-500">Code: {language.code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAvailable && (
                      <button
                        onClick={() => handleDeleteLanguage(language.code)}
                        className="px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-2"
                        title="Delete language file"
                      >
                        {showDeleteConfirm === language.code ? (
                          <>
                            <Check className="w-4 h-4" />
                            Confirm
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => handleDownload(language)}
                      disabled={isAvailable || isDownloading}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
                    >
                      {isDownloading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Downloading...
                        </>
                      ) : isAvailable ? (
                        <>
                          <Check className="w-4 h-4" />
                          Installed
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          Download
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          {showSettings ? (
            <p className="text-xs text-gray-600">
              <strong>Note:</strong> Selected languages will be used for OCR processing. At least one language must be selected.
            </p>
          ) : (
            <p className="text-xs text-gray-600">
              <strong>Note:</strong> After downloading, save the file to{' '}
              <code className="bg-gray-200 px-1 rounded">public/tesseract/</code> and reload the extension.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LanguageDownloadModal;

