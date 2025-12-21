# Privacy Policy for Simple VaultPDF

**Last Updated:** December 2025

## Overview

Simple VaultPDF is a Chrome Extension that provides local PDF editing capabilities. This privacy policy explains how we handle your data.

## Data Collection

**Simple VaultPDF does NOT collect, store, or transmit any user data.**

### What We Don't Do

- ❌ We do not collect personal information
- ❌ We do not track user activity
- ❌ We do not use analytics or tracking services
- ❌ We do not send data to external servers
- ❌ We do not share data with third parties
- ❌ We do not store your PDF files on remote servers

## Local Processing

All PDF operations are performed **entirely on your device**:

- PDF files are loaded and processed locally in your browser
- All editing operations (merge, split, rotate, delete) happen on your computer
- OCR text extraction runs locally using Tesseract.js
- No data leaves your device during any operation

## Storage

Simple VaultPDF uses Chrome's local storage APIs to:

- Store PDF document state (page configurations, rotations, deletion markers)
- Save OCR language preferences
- Cache user interface preferences (zoom level, view mode)

**All stored data remains on your device** and is never transmitted externally.

## Permissions

The extension requires the following permissions:

- **`storage`**: To save your work state and preferences locally
- **`offscreen`**: To run OCR processing without service worker timeouts
- **`unlimitedStorage`**: To handle large PDF files without storage quota errors

These permissions are used **exclusively for local functionality** and do not enable any data transmission.

## Third-Party Services

Simple VaultPDF does not use any third-party services that collect data. The extension operates completely offline and does not communicate with external servers.

## Open Source

Simple VaultPDF is open source. You can review the source code to verify our privacy practices:

**GitHub Repository:** [https://github.com/opzozi/simple-vaultpdf](https://github.com/opzozi/simple-vaultpdf)

## Changes to This Policy

If we make changes to this privacy policy, we will update the "Last Updated" date at the top of this document.

## Contact

If you have questions about this privacy policy, please open an issue on our GitHub repository.

---

**Summary:** Simple VaultPDF is designed with privacy as a core principle. Your PDFs and data never leave your device. Everything is processed locally, securely, and privately.

