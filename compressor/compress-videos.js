/**
 * compress-videos.js
 * Automatically extracts, compresses (H.264 CRF), and re-encodes
 * base64-embedded videos in HTML files.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// 1. Locate FFmpeg binary (uses ffmpeg-engine resolver: local ffmpeg-static, global ffmpeg-static, or system PATH)
let ffmpegBin = 'ffmpeg';
try {
  const ffmpegEngine = require('./ffmpeg-engine.cjs');
  const status = ffmpegEngine.resolveFfmpeg();
  if (status.installed && status.binaryPath) {
    ffmpegBin = status.binaryPath;
  } else {
    ffmpegBin = require('ffmpeg-static');
  }
} catch (_) {
  // Falls back to system ffmpeg if ffmpeg-static is not in node_modules
}

// 2. Configuration
const TARGET_DIR = process.cwd();
const BACKUP_DIR = path.join(TARGET_DIR, '.html_backups');
const TEMP_DIR = path.join(TARGET_DIR, '.temp_compress');
const TARGET_MAX_BYTES = 3.4 * 1024 * 1024; // 3.4 MB threshold
const CRF_VALUE = 26; // 24 = near-lossless, 26 = optimal balance, 28 = higher compression

// Ensure directories exist
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

console.log('Using FFmpeg at:', ffmpegBin);
console.log('Target directory:', TARGET_DIR);
console.log(`Compression settings: CRF ${CRF_VALUE}, preset=slow, pix_fmt=yuv420p\n`);

// 3. Find HTML files
const htmlFiles = fs.readdirSync(TARGET_DIR).filter(f => f.endsWith('.html'));
if (htmlFiles.length === 0) {
  console.log('No HTML files found in', TARGET_DIR);
  process.exit(0);
}

// Cache compressed video by MD5 hash of original base64
const videoCache = new Map();

htmlFiles.forEach(fileName => {
  const filePath = path.join(TARGET_DIR, fileName);
  const backupPath = path.join(BACKUP_DIR, fileName);
  const content = fs.readFileSync(filePath, 'utf8');
  const origFileSize = Buffer.byteLength(content, 'utf8');

  // Backup original file if not already backed up
  if (!fs.existsSync(backupPath)) {
    fs.writeFileSync(backupPath, content, 'utf8');
  }

  // Regex matches data:video/<format>;base64,<payload>
  const videoRegex = /data:video\/([a-zA-Z0-9.-]+);base64,([A-Za-z0-9+/=]+)/g;
  let replacedCount = 0;

  const updatedContent = content.replace(videoRegex, (fullMatch, mime, b64Data) => {
    const hash = crypto.createHash('md5').update(b64Data).digest('hex').slice(0, 10);

    if (!videoCache.has(hash)) {
      const rawInputBuffer = Buffer.from(b64Data, 'base64');
      const inputPath = path.join(TEMP_DIR, `input_${hash}.${mime === 'mp4' ? 'mp4' : mime}`);
      const outputPath = path.join(TEMP_DIR, `output_${hash}.mp4`);

      fs.writeFileSync(inputPath, rawInputBuffer);

      // Video encoding settings optimized for web/ad playables:
      // - libx264: Universal H.264 support across all browsers & WebViews
      // - crf: Constant Rate Factor (26 gives high visual quality with small size)
      // - preset slow: Superior compression efficiency per byte
      // - pix_fmt yuv420p: Mandatory for mobile WebView / iOS Safari compatibility
      // - movflags +faststart: Moves moov atom to the front for instant streaming
      // - c:a copy: Preserves audio stream
      const cmd = `"${ffmpegBin}" -y -i "${inputPath}" -c:v libx264 -crf ${CRF_VALUE} -preset slow -pix_fmt yuv420p -movflags +faststart -c:a copy "${outputPath}"`;

      try {
        execSync(cmd, { stdio: 'pipe' });
        const compressedBuffer = fs.readFileSync(outputPath);

        // Safety check: only use compressed version if it is smaller than original
        if (compressedBuffer.length < rawInputBuffer.length) {
          videoCache.set(hash, compressedBuffer.toString('base64'));
        } else {
          videoCache.set(hash, b64Data); // Keep original if already more compact
        }
      } catch (err) {
        console.error(`Error compressing video [${hash}]:`, err.message);
        videoCache.set(hash, b64Data);
      }
    }

    replacedCount++;
    return `data:video/mp4;base64,${videoCache.get(hash)}`;
  });

  if (replacedCount > 0) {
    fs.writeFileSync(filePath, updatedContent, 'utf8');
    const newFileSize = fs.statSync(filePath).size;
    const reduction = ((1 - newFileSize / origFileSize) * 100).toFixed(1);
    const passed = newFileSize < TARGET_MAX_BYTES;

    console.log(`[OK] ${fileName}`);
    console.log(`     Videos replaced: ${replacedCount}`);
    console.log(`     Size: ${(origFileSize / 1024 / 1024).toFixed(2)} MB -> ${(newFileSize / 1024 / 1024).toFixed(2)} MB (-${reduction}%)`);
    console.log(`     Meets < 3.4 MB target: ${passed ? 'YES' : 'NO'}\n`);
  } else {
    console.log(`[-] ${fileName}: No base64 videos found.\n`);
  }
});

// Cleanup temporary video files
fs.rmSync(TEMP_DIR, { recursive: true, force: true });
console.log('Compression complete! Backups saved to .html_backups/');
