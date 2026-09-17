import sharp from 'sharp';
import { writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, '..', 'public');
const assetsDir = join(__dirname, 'assets');

async function generateIconsFromSource(sourcePath, sizes) {
  if (!existsSync(sourcePath)) {
    throw new Error(`Source icon file not found: ${sourcePath}\nPlace your PNG icon at scripts/assets/icon-source.png`);
  }

  console.log(`Reading source icon from: ${sourcePath}`);
  
  for (const size of sizes) {
    try {
      const trimmedImage = await sharp(sourcePath)
        .ensureAlpha()
        .trim({ threshold: 10 })
        .toBuffer();
      
      const trimmedMetadata = await sharp(trimmedImage).metadata();
      const trimmedWidth = trimmedMetadata.width || size;
      const trimmedHeight = trimmedMetadata.height || size;
      
      const scale = Math.min(size / trimmedWidth, size / trimmedHeight);
      const newWidth = Math.round(trimmedWidth * scale);
      const newHeight = Math.round(trimmedHeight * scale);
      
      const left = Math.floor((size - newWidth) / 2);
      const top = Math.floor((size - newHeight) / 2);
      
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
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png({ 
          compressionLevel: 9,
          adaptiveFiltering: true,
          force: true
        })
        .toBuffer();
      
      const filePath = join(publicDir, `icon-${size}.png`);
      writeFileSync(filePath, pngBuffer);
      console.log(`Wrote icon-${size}.png (${size}x${size})`);
    } catch (error) {
      console.error(`Error generating icon-${size}.png:`, error.message);
      throw error;
    }
  }
}

async function main() {
  const sizes = [16, 48, 128];
  
  const possibleSourcePaths = [
    join(assetsDir, 'icon-source.png'),
    join(assetsDir, 'icon.png'),
    join(publicDir, 'icon-128.png'),
  ];
  
  let sourcePath = null;
  for (const path of possibleSourcePaths) {
    if (existsSync(path)) {
      sourcePath = path;
      break;
    }
  }
  
  if (!sourcePath) {
    console.error('No source icon file found.');
    console.log('\nPlace your PNG icon file at scripts/assets/icon-source.png');
    process.exit(1);
  }
  
  console.log('Generating icon files from source...\n');
  
  try {
    await generateIconsFromSource(sourcePath, sizes);
    console.log('\nIcon generation complete.');
    console.log(`Generated files: icon-16.png, icon-48.png, icon-128.png`);
  } catch (error) {
    console.error('\nError:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
