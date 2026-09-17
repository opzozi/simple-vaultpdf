import React, { useState, useEffect } from 'react';
import { X, Download, Check, AlertCircle, Trash2, CheckSquare, Square } from 'lucide-react';
import { getAvailableLanguages } from '@/lib/ocr/tesseractConfig';
import { getSelectedLanguages, setSelectedLanguages } from '@/lib/ocr/storage';
import {
  deleteDownloadedLanguage,
  downloadLanguagePack,
  isBundledLanguage,
} from '@/lib/ocr/languagePacks';

interface LanguageInfo {
  code: string;
  name: string;
}

const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'eng', name: 'English' },
  { code: 'hun', name: 'Hungarian' },
  { code: 'deu', name: 'German' },
  { code: 'fra', name: 'French' },
  { code: 'spa', name: 'Spanish' },
  { code: 'ita', name: 'Italian' },
  { code: 'por', name: 'Portuguese' },
  { code: 'rus', name: 'Russian' },
  { code: 'chi_sim', name: 'Chinese (Simplified)' },
  { code: 'jpn', name: 'Japanese' },
];

interface LanguageDownloadModalProps {
  onClose: () => void;
  onLanguageDownloaded?: () => void;
  showSettings?: boolean;
}

const LanguageDownloadModal: React.FC<LanguageDownloadModalProps> = ({
  onClose,
  onLanguageDownloaded,
  showSettings = false,
}) => {
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguagesState] = useState<string[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
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
      const languages = await getAvailableLanguages();
      setAvailableLanguages(languages);
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
      newSelected = selectedLanguages.filter((l) => l !== code);
      if (newSelected.length === 0) {
        newSelected = ['eng'];
      }
    } else {
      newSelected = [...selectedLanguages, code];
    }

    setSelectedLanguagesState(newSelected);
    await setSelectedLanguages(newSelected);
  };

  const handleDeleteLanguage = async (code: string) => {
    if (isBundledLanguage(code)) {
      setError('English and Hungarian are included offline and cannot be removed.');
      return;
    }

    if (showDeleteConfirm !== code) {
      setShowDeleteConfirm(code);
      return;
    }

    try {
      await deleteDownloadedLanguage(code);

      let newSelected = selectedLanguages.filter((l) => l !== code);
      if (newSelected.length === 0) {
        newSelected = ['eng'];
      }
      setSelectedLanguagesState(newSelected);
      await setSelectedLanguages(newSelected);
      setAvailableLanguages((prev) => prev.filter((l) => l !== code));
      setShowDeleteConfirm(null);
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(`Failed to remove language: ${errorMsg}`);
      setShowDeleteConfirm(null);
    }
  };

  const handleDownload = async (language: LanguageInfo) => {
    if (isBundledLanguage(language.code)) return;

    setDownloading(language.code);
    setDownloadProgress(0);
    setError(null);

    try {
      await downloadLanguagePack(language.code, setDownloadProgress);
      await loadAvailableLanguages();

      if (!selectedLanguages.includes(language.code)) {
        const next = [...selectedLanguages, language.code];
        setSelectedLanguagesState(next);
        await setSelectedLanguages(next);
      }

      onLanguageDownloaded?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Download failed';
      setError(`Failed to download ${language.name}: ${errorMessage}`);
    } finally {
      setDownloading(null);
      setDownloadProgress(0);
    }
  };

  const isLanguageAvailable = (code: string) => availableLanguages.includes(code);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {showSettings ? 'OCR Language Settings' : 'Download OCR Languages'}
            </h2>
            <p className="text-sm text-gray-500">
              English and Hungarian work offline. Extra languages download once and stay on this device.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

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
              const bundled = isBundledLanguage(language.code);

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
                        {bundled && (
                          <span className="ml-2 text-xs text-green-700">Offline</span>
                        )}
                        {showSettings && isAvailable && selectedLanguages.includes(language.code) && (
                          <span className="ml-2 text-xs text-blue-600">(Selected)</span>
                        )}
                      </p>
                      <p className="text-sm text-gray-500">Code: {language.code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAvailable && !bundled && (
                      <button
                        onClick={() => handleDeleteLanguage(language.code)}
                        className="px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-2"
                        title="Remove downloaded language pack"
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
                          {downloadProgress > 0 ? `${downloadProgress}%` : 'Downloading...'}
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

        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-600">
            Extra language packs are fetched from the Tesseract tessdata_fast project and stored only on this device. PDF files never leave your computer.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LanguageDownloadModal;
