import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const tesseractDir = path.join(rootDir, 'public', 'tesseract');
const coreDir = path.join(rootDir, 'node_modules', 'tesseract.js-core');
const workerSrc = path.join(rootDir, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js');

const TESSDATA_FAST = {
  eng: 'https://cdn.jsdelivr.net/gh/tesseract-ocr/tessdata_fast@main/eng.traineddata',
  hun: 'https://cdn.jsdelivr.net/gh/tesseract-ocr/tessdata_fast@main/hun.traineddata',
};

fs.mkdirSync(tesseractDir, { recursive: true });

function copyFile(src, destName) {
  const dest = path.join(tesseractDir, destName);
  fs.copyFileSync(src, dest);
  const mb = (fs.statSync(dest).size / 1024 / 1024).toFixed(2);
  console.log(`Copied ${destName} (${mb} MB)`);
}

async function downloadAndGzip(url, destName) {
  const dest = path.join(tesseractDir, destName);
  console.log(`Downloading ${url}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const gzipped = zlib.gzipSync(buffer, { level: 9 });
  fs.writeFileSync(dest, gzipped);
  const mb = (gzipped.length / 1024 / 1024).toFixed(2);
  console.log(`Copied ${destName} (${mb} MB gzipped from ${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
}

const obsolete = [
  'tesseract-core.wasm.js',
  'tesseract-core.wasm',
];

for (const name of obsolete) {
  const filePath = path.join(tesseractDir, name);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`Removed obsolete ${name}`);
  }
}

if (!fs.existsSync(workerSrc)) {
  throw new Error('tesseract.js worker not found. Run npm install first.');
}
copyFile(workerSrc, 'worker.min.js');

const lstmCore = path.join(coreDir, 'tesseract-core-lstm.wasm.js');
if (!fs.existsSync(lstmCore)) {
  throw new Error('tesseract-core-lstm.wasm.js not found. Run npm install first.');
}
copyFile(lstmCore, 'tesseract-core-lstm.wasm.js');

await downloadAndGzip(TESSDATA_FAST.eng, 'eng.traineddata.gz');
await downloadAndGzip(TESSDATA_FAST.hun, 'hun.traineddata.gz');

console.log('OCR assets ready in public/tesseract/');
