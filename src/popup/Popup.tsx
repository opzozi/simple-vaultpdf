import React, { useState } from 'react';
import { FileText, Settings, FolderOpen, Heart, Trash2, Star, Shield, ArrowLeft, ExternalLink } from 'lucide-react';
import packageJson from '../../package.json';

const POPUP_VERSION = packageJson.version || '1.0.0';

const Popup: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false);

  const openVault = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/app/index.html') });
  };

  const handleDonate = () => {
    chrome.tabs.create({ url: 'https://www.paypal.com/donate/?hosted_button_id=KSNA8YZWGMDFG' });
  };

  const handleReset = () => {
    const confirmed = window.confirm(
      'Are you sure you want to reset the application?\n\n' +
      'This will:\n' +
      '• Clear all stored data (localStorage, Chrome Storage)\n' +
      '• Clear IndexedDB\n' +
      '• Reload the extension\n\n' +
      'This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.clear();
      }

      chrome.storage.local.clear(() => {
        console.log('Chrome storage cleared');
      });
      chrome.storage.sync.clear(() => {
        console.log('Chrome sync storage cleared');
      });

      if ('indexedDB' in window) {
        indexedDB.databases().then((databases) => {
          databases.forEach((db) => {
            if (db.name) {
              indexedDB.deleteDatabase(db.name);
            }
          });
        }).catch((err) => {
          console.warn('Could not clear IndexedDB:', err);
        });
      }

      setTimeout(() => {
        chrome.runtime.reload();
      }, 500);
    } catch (error) {
      console.error('Error resetting application:', error);
      alert('An error occurred while resetting. Please try reloading the extension manually.');
    }
  };

  const handleRateUs = () => {
    chrome.tabs.create({ url: 'https://chromewebstore.google.com/detail/simple-vaultpdf/nefkedjebfockbphoninolplkhgpakoh/reviews?hl=hu&utm_source=ext_sidebar' });
  };

  const handlePrivacyPolicy = () => {
    chrome.tabs.create({ url: 'https://github.com/opzozi/simple-vaultpdf/blob/main/PRIVACY.md' });
  };

  const openSimpleImageConverter = () => {
    chrome.tabs.create({ url: 'https://chromewebstore.google.com/detail/simple-image-converter/clinbfiephmemllcffpddoabnknkaeki?hl=hu&utm_source=ext_sidebar' });
  };

  const openTailwindColorPicker = () => {
    chrome.tabs.create({ url: 'https://chromewebstore.google.com/detail/tailwind-color-picker/iijbeejepebedocldehadgofaejcmbla?hl=hu&utm_source=ext_sidebar' });
  };

  if (showSettings) {
    return (
      <div className="w-64 bg-white relative min-h-[400px] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex-shrink-0">
          <button
            onClick={() => setShowSettings(false)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
          </div>
        </div>

        {/* Settings Menu */}
        <div className="flex-1 p-2 pb-16 overflow-y-auto">
          <div className="space-y-1">
            {/* Privacy Policy Button */}
            <button
              onClick={handlePrivacyPolicy}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg hover:bg-blue-50 transition-colors group border border-transparent hover:border-blue-200"
            >
              <div className="p-1.5 rounded-md bg-blue-100 group-hover:bg-blue-200 transition-colors">
                <Shield className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">Privacy Policy</div>
                <div className="text-xs text-gray-500">How we handle your data</div>
              </div>
            </button>

            {/* Reset Button */}
            <button
              onClick={handleReset}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg hover:bg-red-50 transition-colors group border border-transparent hover:border-red-200"
            >
              <div className="p-1.5 rounded-md bg-red-100 group-hover:bg-red-200 transition-colors">
                <Trash2 className="w-4 h-4 text-red-600" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">Reset Application</div>
                <div className="text-xs text-gray-500">Clear all data & reload</div>
              </div>
            </button>
          </div>
        </div>

        {/* Footer with Version */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <p className="text-xs text-gray-500 text-center">v{POPUP_VERSION}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 bg-white relative min-h-[400px] flex flex-col">
      {/* Main View */}
      <div className="p-4 pb-20 flex-1 overflow-y-auto">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-semibold text-gray-900">Simple VaultPDF</h1>
        </div>
        
        <div className="space-y-2 mb-6">
          <button
            onClick={openVault}
            className="w-full flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <FolderOpen className="w-4 h-4" />
            Open Vault
          </button>
          
          <button
            onClick={() => setShowSettings(true)}
            className="w-full flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </div>

        {/* Rate & Support Section */}
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Rate & Support</h3>
          <div className="space-y-2">
            <button
              onClick={handleRateUs}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <Star className="w-4 h-4 text-yellow-500" />
              <span>Rate Simple VaultPDF</span>
              <ExternalLink className="w-3 h-3 text-gray-400 ml-auto" />
            </button>
            <button
              onClick={handleDonate}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium"
            >
              <Heart className="w-4 h-4" />
              <span>Support on PayPal</span>
            </button>
          </div>
        </div>

        {/* Recommended Extensions */}
        <div className="border-t border-gray-200 pt-4 mt-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">More from Developer</h3>
          <div className="space-y-2">
            <button
              onClick={openSimpleImageConverter}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <div className="w-6 h-6 rounded bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                SIC
              </div>
              <span className="flex-1 text-left">Simple Image Converter</span>
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </button>
            <button
              onClick={openTailwindColorPicker}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <div className="w-6 h-6 rounded bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold">
                TCP
              </div>
              <span className="flex-1 text-left">Tailwind Color Picker</span>
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Footer with Version */}
      <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">v{POPUP_VERSION}</p>
          <button
            onClick={handleRateUs}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-yellow-600 transition-colors"
          >
            <Star className="w-3 h-3" />
            <span>Rate</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Popup;

