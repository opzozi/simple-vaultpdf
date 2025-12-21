import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Web Store image specifications
const PROMO_TILE = {
  width: 440,
  height: 280,
  name: 'img-00-promo-tile'
};

const SCREENSHOTS = [
  { width: 1280, height: 800, name: 'img-01-screenshot-1280x800' },
  { width: 640, height: 400, name: 'img-02-screenshot-640x400' },
  { width: 1280, height: 800, name: 'img-03-screenshot-1280x800' },
  { width: 640, height: 400, name: 'img-04-screenshot-640x400' },
  { width: 1280, height: 800, name: 'img-05-screenshot-1280x800' },
];

const INPUT_DIR = path.join(rootDir, 'screenshots', 'source');
const OUTPUT_DIR = path.join(rootDir, 'screenshots', 'webstore');

console.log('🖼️  Preparing Chrome Web Store images...\n');

// Ensure directories exist
if (!fs.existsSync(INPUT_DIR)) {
  console.error(`❌ Source images directory not found: ${INPUT_DIR}`);
  console.log('\n📋 Instructions:');
  console.log('   1. Create a "screenshots/source" folder in the project root');
  console.log('   2. Place your source images there:');
  console.log('      - img-00-source.jpg/png (for promo tile)');
  console.log('      - img-01-source.jpg/png (for screenshot 1)');
  console.log('      - img-02-source.jpg/png (for screenshot 2)');
  console.log('      - img-03-source.jpg/png (for screenshot 3)');
  console.log('      - img-04-source.jpg/png (for screenshot 4)');
  console.log('      - img-05-source.jpg/png (for screenshot 5)');
  console.log('   3. Run this script again\n');
  process.exit(1);
}

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Resize image to target dimensions without distortion
 * Uses letterboxing/pillarboxing to maintain aspect ratio
 */
async function resizeImage(inputPath, outputPath, targetWidth, targetHeight) {
  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    
    const sourceAspect = metadata.width / metadata.height;
    const targetAspect = targetWidth / targetHeight;
    
    let resizeWidth, resizeHeight;
    let left = 0, top = 0;
    
    if (sourceAspect > targetAspect) {
      // Source is wider - fit to height, add horizontal padding
      resizeHeight = targetHeight;
      resizeWidth = Math.round(targetHeight * sourceAspect);
      left = Math.round((targetWidth - resizeWidth) / 2);
    } else {
      // Source is taller - fit to width, add vertical padding
      resizeWidth = targetWidth;
      resizeHeight = Math.round(targetWidth / sourceAspect);
      top = Math.round((targetHeight - resizeHeight) / 2);
    }
    
    // Ensure resize dimensions don't exceed target dimensions
    if (resizeWidth > targetWidth) {
      resizeWidth = targetWidth;
      resizeHeight = Math.round(targetWidth / sourceAspect);
      top = Math.round((targetHeight - resizeHeight) / 2);
      left = 0;
    }
    if (resizeHeight > targetHeight) {
      resizeHeight = targetHeight;
      resizeWidth = Math.round(targetHeight * sourceAspect);
      left = Math.round((targetWidth - resizeWidth) / 2);
      top = 0;
    }
    
    // Resize the image first
    const resizedBuffer = await image
      .resize(resizeWidth, resizeHeight, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255 }
      })
      .removeAlpha() // Remove alpha channel for JPEG
      .jpeg({ quality: 95 })
      .toBuffer();
    
    // Create white background and composite the resized image
    await sharp({
      create: {
        width: targetWidth,
        height: targetHeight,
        channels: 3,
        background: { r: 255, g: 255, b: 255 }
      }
    })
    .composite([
      {
        input: resizedBuffer,
        left: Math.max(0, left),
        top: Math.max(0, top)
      }
    ])
    .jpeg({ quality: 95, mozjpeg: true })
    .toFile(outputPath);
    
    console.log(`✅ Created: ${path.basename(outputPath)} (${targetWidth}x${targetHeight})`);
  } catch (error) {
    console.error(`❌ Error processing ${inputPath}:`, error.message);
    throw error;
  }
}

/**
 * Process promo tile
 */
async function processPromoTile() {
  const sourceFiles = [
    path.join(INPUT_DIR, 'img-00-source.jpg'),
    path.join(INPUT_DIR, 'img-00-source.png'),
    path.join(INPUT_DIR, 'img-00-source.jpeg'),
  ];
  
  const sourceFile = sourceFiles.find(file => fs.existsSync(file));
  
  if (!sourceFile) {
    console.warn('⚠️  Promo tile source not found (img-00-source.jpg/png)');
    return;
  }
  
  const outputPath = path.join(OUTPUT_DIR, `${PROMO_TILE.name}.jpg`);
  await resizeImage(sourceFile, outputPath, PROMO_TILE.width, PROMO_TILE.height);
}

/**
 * Process screenshots
 */
async function processScreenshots() {
  for (let i = 0; i < SCREENSHOTS.length; i++) {
    const screenshot = SCREENSHOTS[i];
    const sourceNumber = String(i + 1).padStart(2, '0');
    
    const sourceFiles = [
      path.join(INPUT_DIR, `img-${sourceNumber}-source.jpg`),
      path.join(INPUT_DIR, `img-${sourceNumber}-source.png`),
      path.join(INPUT_DIR, `img-${sourceNumber}-source.jpeg`),
    ];
    
    const sourceFile = sourceFiles.find(file => fs.existsSync(file));
    
    if (!sourceFile) {
      console.warn(`⚠️  Screenshot ${i + 1} source not found (img-${sourceNumber}-source.jpg/png)`);
      continue;
    }
    
    const outputPath = path.join(OUTPUT_DIR, `${screenshot.name}.jpg`);
    await resizeImage(sourceFile, outputPath, screenshot.width, screenshot.height);
  }
}

// Main execution
async function main() {
  try {
    console.log('1️⃣ Processing promo tile...');
    await processPromoTile();
    
    console.log('\n2️⃣ Processing screenshots...');
    await processScreenshots();
    
    console.log('\n🎉 All images processed successfully!');
    console.log(`\n📁 Output directory: ${OUTPUT_DIR}`);
    console.log('\n📋 Next steps:');
    console.log('   1. Review the generated images');
    console.log('   2. Upload them to Chrome Web Store:');
    console.log('      - img-00-promo-tile.jpg → Promo tile (440x280)');
    console.log('      - img-01-screenshot-*.jpg → Screenshots (1280x800 or 640x400)');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();

