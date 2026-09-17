import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import archiver from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const releaseDir = path.join(rootDir, 'release');
const distDir = path.join(rootDir, 'dist');
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));

console.log('Packaging Simple VaultPDF for Chrome Web Store...\n');

console.log('1. Building project...');
try {
  execSync('npm run build', { stdio: 'inherit', cwd: rootDir });
  console.log('Build completed\n');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}

if (!fs.existsSync(distDir)) {
  console.error('dist directory not found. Build may have failed.');
  process.exit(1);
}

console.log('2. Preparing release directory...');
fs.mkdirSync(releaseDir, { recursive: true });

console.log('3. Creating ZIP archive...');
const zipPath = path.join(releaseDir, `simple-vaultpdf-${packageJson.version}.zip`);

if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', {
  zlib: { level: 9 }
});

output.on('close', () => {
  const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
  console.log(`ZIP created: ${zipPath} (${sizeInMB} MB)\n`);
  console.log('Packaging complete.\n');
  console.log('Next steps:');
  console.log(`   1. Review the package in: ${releaseDir}`);
  console.log(`   2. Upload ZIP to Chrome Web Store: ${path.basename(zipPath)}`);
  console.log(`   3. Version: ${packageJson.version}\n`);
});

archive.on('error', (err) => {
  console.error('ZIP creation failed:', err);
  process.exit(1);
});

archive.pipe(output);
archive.glob('**/*', {
  cwd: distDir,
  ignore: ['.vite/**'],
  dot: false,
});
archive.finalize();
