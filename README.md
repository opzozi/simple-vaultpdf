# Simple VaultPDF

Chrome extension for reading and editing PDFs in the browser. Files stay on your device.

Version **1.2.0**.

## What it does

- Read PDFs with zoom. The toolbar shows the current page (`Page 14 of 18`), and each page has a page number overlay.
- Organize pages: reorder, rotate, restore, delete.
- Merge PDFs (drop several files, or use Add PDF). Encrypted or otherwise uncopyable pages are merged as images.
- Extract selected pages into a new PDF.
- Save the current page as PNG or JPG.
- Extract Text:
  - Copies embedded PDF text when the page already has a usable text layer.
  - Runs local Tesseract.js OCR (`tessdata_fast`) only on scanned pages.
  - English and Hungarian OCR models are bundled. Extra languages download once into IndexedDB.
  - Optional Force OCR if you want to ignore embedded text.

## Install

Chrome Web Store: add the extension, then click the icon and open the vault.

Load unpacked from source:

```bash
git clone https://github.com/opzozi/simple-vaultpdf.git
cd simple-vaultpdf
npm install
npm run build
```

In `chrome://extensions/` enable Developer mode, Load unpacked, and select the `dist` folder.

## Support

- PayPal: [donate](https://www.paypal.com/donate/?hosted_button_id=KSNA8YZWGMDFG)
- GitHub: star the [repository](https://github.com/opzozi/simple-vaultpdf)
- Chrome Web Store: leave a review

## Development

Requires Node.js 18+ and Chrome.

```bash
npm install
npm run generate-icons   # optional, from scripts/assets/icon-source.png
npm run prepare:ocr      # refresh bundled Tesseract worker/core/language files
npm run dev
```

Load the `dist` folder as an unpacked extension. Vite + `@crxjs/vite-plugin` hot-reloads React changes.

```bash
npm run build
npm run package:webstore
```

`package:webstore` writes `release/simple-vaultpdf-<version>.zip` and skips Vite metadata (`.vite/`). Keep `icon-source.png` out of `public/` so it is not shipped.

## Layout

```
/src
  /background    Service worker
  /offscreen     Offscreen document for OCR
  /popup         Extension popup
  /app           Full-page editor
  /features      PDF viewer, organizer, OCR UI
  /lib           PDF and OCR helpers
```

## Privacy

PDF processing runs locally. Extra OCR language packs are downloaded only if you request them. See [PRIVACY.md](PRIVACY.md).

## License

MIT
