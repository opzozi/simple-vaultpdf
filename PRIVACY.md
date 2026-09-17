# Privacy Policy for Simple VaultPDF

**Last Updated:** September 2026

## Overview

Simple VaultPDF is a Chrome extension for local PDF editing. This policy describes what data is involved.

## PDF files

Simple VaultPDF does not collect, store remotely, or transmit your PDF files. Editing, merging, splitting, and text extraction run in the browser on your device.

## What is not collected

- Personal information
- Usage analytics
- Document contents sent to a server

## Optional language pack downloads

English and Hungarian OCR models are included and work offline.

If you download another OCR language, the extension fetches that file from the public Tesseract `tessdata_fast` project (via jsDelivr) after you click Download. The file is stored in IndexedDB on your device. PDF files are not sent with that request.

You can delete a downloaded language pack from OCR language settings.

## Storage

Chrome local storage and IndexedDB are used to:

- Save OCR language preferences
- Cache downloaded OCR language packs
- Handle large files (`unlimitedStorage`)

This data stays on your device.

## Permissions

- `storage`: preferences and OCR settings
- `offscreen`: OCR without service worker timeouts
- `unlimitedStorage`: large PDFs and optional language packs

These permissions are for local use. They do not upload your documents.

## Source

https://github.com/opzozi/simple-vaultpdf

## Changes

If this policy changes, the date at the top will be updated.

## Contact

Open an issue on the GitHub repository.

---

Summary: PDFs stay on your device. Extra OCR languages download only when you ask for them, and those files are stored locally.
