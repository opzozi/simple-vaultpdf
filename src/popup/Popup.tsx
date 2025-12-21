import React, { useState } from 'react';
import { FileText, Settings, FolderOpen, Heart, Trash2, Star, Shield, ArrowLeft } from 'lucide-react';
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
      // Clear localStorage
      if (typeof localStorage !== 'undefined') {
        localStorage.clear();
      }

      // Clear Chrome Storage
      chrome.storage.local.clear(() => {
        console.log('Chrome storage cleared');
      });
      chrome.storage.sync.clear(() => {
        console.log('Chrome sync storage cleared');
      });

      // Clear IndexedDB (attempt)
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

      // Reload extension after a short delay
      setTimeout(() => {
        chrome.runtime.reload();
      }, 500);
    } catch (error) {
      console.error('Error resetting application:', error);
      alert('An error occurred while resetting. Please try reloading the extension manually.');
    }
  };

  const handleRateUs = () => {
    chrome.tabs.create({ url: 'https://chrome.google.com/webstore' });
  };

  const handlePrivacyPolicy = () => {
    // Placeholder - will be updated later
    alert('Privacy Policy coming soon. This extension processes all data locally and does not send any information to external servers.');
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
            {/* Donate Button */}
            <button
              onClick={handleDonate}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg hover:bg-pink-50 transition-colors group border border-transparent hover:border-pink-200"
            >
              <div className="p-1.5 rounded-md bg-pink-100 group-hover:bg-pink-200 transition-colors">
                <Heart className="w-4 h-4 text-pink-600" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">Support Development</div>
                <div className="text-xs text-gray-500">Donate via PayPal</div>
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

            {/* Rate Us Button */}
            <button
              onClick={handleRateUs}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg hover:bg-yellow-50 transition-colors group border border-transparent hover:border-yellow-200"
            >
              <div className="p-1.5 rounded-md bg-yellow-100 group-hover:bg-yellow-200 transition-colors">
                <Star className="w-4 h-4 text-yellow-600" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">Rate Simple VaultPDF</div>
                <div className="text-xs text-gray-500">Share your feedback</div>
              </div>
            </button>

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
    <div className="w-64 bg-white relative min-h-[200px] flex flex-col">
      {/* Main View */}
      <div className="p-4 pb-16 flex-1">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-semibold text-gray-900">Simple VaultPDF</h1>
        </div>
        
        <div className="space-y-2">
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
      </div>

      {/* Footer with Version */}
      <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
        <p className="text-xs text-gray-500 text-center">v{POPUP_VERSION}</p>
      </div>
    </div>
  );
};

export default Popup;

