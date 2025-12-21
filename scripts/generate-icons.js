import sharp from 'sharp';
import { writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, '..', 'public');

async function generateIconsFromSource(sourcePath, sizes) {
  if (!existsSync(sourcePath)) {
    throw new Error(`Source icon file not found: ${sourcePath}\nPlease place your PNG icon file in the public/ folder as 'icon-source.png'`);
  }

  console.log(`Reading source icon from: ${sourcePath}`);
  
  for (const size of sizes) {
    try {
      // Use trim to remove white background from edges
      // threshold: 10 means pixels with RGB values > 245 are considered white
      const trimmedImage = await sharp(sourcePath)
        .ensureAlpha()
        .trim({ threshold: 10 })
        .toBuffer();
      
      // Get trimmed image metadata
      const trimmedMetadata = await sharp(trimmedImage).metadata();
      const trimmedWidth = trimmedMetadata.width || size;
      const trimmedHeight = trimmedMetadata.height || size;
      
      // Calculate scale to fit within size x size while maintaining aspect ratio
      const scale = Math.min(size / trimmedWidth, size / trimmedHeight);
      const newWidth = Math.round(trimmedWidth * scale);
      const newHeight = Math.round(trimmedHeight * scale);
      
      // Calculate padding to center the image
      const left = Math.floor((size - newWidth) / 2);
      const top = Math.floor((size - newHeight) / 2);
      
      // Resize trimmed image and extend with transparent background
      const pngBuffer = await sharp(trimmedImage)
        .resize(newWidth, newHeight, {
          fit: 'inside',
          withoutEnlargement: false
        })
        .extend({
          top: top,
          bottom: size - newHeight - top,
          left: left,
          right: size - newWidth - left,
          background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
        })
        .png({ 
          compressionLevel: 9,
          adaptiveFiltering: true,
          force: true
        })
        .toBuffer();
      
      const filePath = join(publicDir, `icon-${size}.png`);
      writeFileSync(filePath, pngBuffer);
      console.log(`✓ Generated icon-${size}.png (${size}x${size})`);
    } catch (error) {
      console.error(`Error generating icon-${size}.png:`, error.message);
      throw error;
    }
  }
}

async function main() {
  const sizes = [16, 48, 128];
  
  // Try to find source icon file (check multiple possible names)
  const possibleSourceNames = [
    'icon-source.png',
    'icon.png',
    'source-icon.png',
    'icon-128.png', // Fallback: use existing 128px icon as source
  ];
  
  let sourcePath = null;
  for (const name of possibleSourceNames) {
    const path = join(publicDir, name);
    if (existsSync(path)) {
      sourcePath = path;
      break;
    }
  }
  
  if (!sourcePath) {
    console.error('❌ No source icon file found!');
    console.log('\nPlease do one of the following:');
    console.log('1. Place your PNG icon file in the public/ folder as "icon-source.png"');
    console.log('2. Or place it as "icon.png" or "source-icon.png"');
    console.log('3. Or run this script after placing the file');
    process.exit(1);
  }
  
  console.log('Generating icon files from source...\n');
  
  try {
    await generateIconsFromSource(sourcePath, sizes);
    console.log('\n✅ Icon generation complete!');
    console.log(`Generated files: icon-16.png, icon-48.png, icon-128.png`);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
