import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import archiver from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const webstoreDir = path.join(rootDir, 'webstore');
const distDir = path.join(rootDir, 'dist');
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));

console.log('📦 Packaging Simple VaultPDF for Chrome Web Store...\n');

// Step 1: Build the project
console.log('1️⃣ Building project...');
try {
  execSync('npm run build', { stdio: 'inherit', cwd: rootDir });
  console.log('✅ Build completed successfully\n');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

// Step 2: Clean and create webstore directory
console.log('2️⃣ Preparing webstore directory...');
if (fs.existsSync(webstoreDir)) {
  fs.rmSync(webstoreDir, { recursive: true, force: true });
}
fs.mkdirSync(webstoreDir, { recursive: true });
console.log('✅ Webstore directory ready\n');

// Step 3: Copy dist contents to webstore
console.log('3️⃣ Copying build files...');
function copyRecursive(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (!fs.existsSync(distDir)) {
  console.error('❌ dist directory not found. Build may have failed.');
  process.exit(1);
}

copyRecursive(distDir, webstoreDir);
console.log('✅ Files copied\n');

// Step 4: Create ZIP file
console.log('4️⃣ Creating ZIP archive...');
const zipPath = path.join(rootDir, `simple-vaultpdf-${packageJson.version}.zip`);

// Remove existing ZIP if it exists
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', {
  zlib: { level: 9 } // Maximum compression
});

output.on('close', () => {
  const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
  console.log(`✅ ZIP created: ${path.basename(zipPath)} (${sizeInMB} MB)\n`);
  console.log('🎉 Packaging complete!\n');
  console.log('📋 Next steps:');
  console.log(`   1. Review the package in: ${webstoreDir}`);
  console.log(`   2. Upload ZIP to Chrome Web Store: ${path.basename(zipPath)}`);
  console.log(`   3. Version: ${packageJson.version}\n`);
});

archive.on('error', (err) => {
  console.error('❌ ZIP creation failed:', err);
  process.exit(1);
});

archive.pipe(output);

// Add all files from dist directory
archive.directory(distDir, false);

archive.finalize();

